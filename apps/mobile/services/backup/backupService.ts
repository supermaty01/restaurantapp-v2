import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { z } from 'zod';

import { IMAGES_DIR, SQLITE_DIR } from '@/lib/helpers/fs-paths';
import { DATABASE_NAME } from '@/services/db/constants';
import * as schema from '@/services/db/schema';
import type { DrizzleDatabase } from '@/services/db/types';

import { EXPORT_PREFIX, SAFETY_PREFIX, archivesToPrune } from './prune';
import { createZipFromDirectory, extractZipToDirectory } from './zip';

/**
 * These records are JSON blobs read back from app_settings, i.e. an untrusted
 * boundary (an old app version may have written a different shape). Parse with
 * zod rather than trusting the cast - docs/12-calidad.md.
 */
const exportInfoSchema = z.object({
  date: z.string(),
  path: z.string(),
  size: z.number().optional(),
  version: z.string().optional(),
});

const backupInfoSchema = z.object({
  date: z.string(),
  path: z.string(),
});

export interface BackupInfo {
  date: Date;
  path: string;
  size: number;
  version: string;
}

export interface ExportOptions {
  /**
   * Si la copia tiene que sobrevivir a la pantalla que la creó.
   *
   * Por defecto **no**: la copia que se exporta desde Ajustes existe para salir
   * de la app —se comparte a Drive, a WhatsApp, a donde sea— y quedarse con
   * ella dentro es guardar el diario entero dos veces. Va a la caché, que es
   * exactamente lo que el sistema puede reclamar cuando aprieta.
   *
   * `true` solo para la copia previa a «la nube manda» (`sync-choice`): esa es
   * la red de seguridad de la única pantalla capaz de borrar un diario entero y
   * tiene que seguir ahí mañana, así que va al directorio de documentos.
   */
  keep?: boolean;
}

export interface ImportInfo {
  date: Date;
  path: string;
  backupPath: string;
}

export class BackupService {
  constructor(
    private drizzleDb: DrizzleDatabase,
    private appVersion: string,
  ) {}

  /**
   * Exports database and images to a ZIP file using native compression.
   */
  async exportData(
    progressCallback: (progress: number) => void,
    options: ExportOptions = {},
  ): Promise<BackupInfo> {
    progressCallback(0);

    const keep = options.keep ?? false;
    const tempDir = `${FileSystem.cacheDirectory}export_temp/`;
    const imagesTemp = `${tempDir}images/`;

    // Staging area: the archive mirrors this layout (database.db,
    // metadata.json, images/…), which is also the layout v1 produced, so old
    // and new backups stay interchangeable.
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    await FileSystem.makeDirectoryAsync(imagesTemp, { intermediates: true });
    progressCallback(5);

    const dbSrc = `${SQLITE_DIR}${DATABASE_NAME}`;
    await FileSystem.copyAsync({ from: dbSrc, to: `${tempDir}database.db` });
    progressCallback(15);

    const metadata = {
      version: this.appVersion,
      exportDate: new Date().toISOString(),
    };
    await FileSystem.writeAsStringAsync(`${tempDir}metadata.json`, JSON.stringify(metadata));
    progressCallback(20);

    const imageFiles = await FileSystem.readDirectoryAsync(IMAGES_DIR).catch(() => []);
    await this.copyFilesInBatches(imageFiles, IMAGES_DIR, imagesTemp, (p) =>
      progressCallback(20 + Math.floor(p * 50)),
    );
    progressCallback(70);

    // Barrer **antes** de escribir la nueva: si se hiciera después habría un
    // momento con dos diarios enteros en disco, que en un móvil lleno es la
    // diferencia entre exportar y no poder.
    //
    // Cada zip pesa casi lo que la carpeta de imágenes entera —un zip no
    // comprime JPEG, que ya vienen comprimidos—, así que sin esto cada
    // exportación dejaba ~200 MB para siempre y con un nombre distinto cada vez.
    // Cinco o diez exportaciones son el giga o dos que se veía en el móvil.
    await this.pruneArchives(keep ? SAFETY_PREFIX : EXPORT_PREFIX);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipName = `${keep ? SAFETY_PREFIX : EXPORT_PREFIX}${timestamp}.zip`;
    const zipPath = `${keep ? FileSystem.documentDirectory : FileSystem.cacheDirectory}${zipName}`;

    // Streams to disk: backups run to hundreds of MB, so nothing is buffered.
    await createZipFromDirectory(tempDir, zipPath);
    progressCallback(90);

    // Get file info and save to DB
    const info = await FileSystem.getInfoAsync(zipPath);
    const size = (info as { size?: number }).size || 0;

    await this.saveExportInfo(zipPath, size);

    // Cleanup temp directory
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    progressCallback(100);

    return { date: new Date(), path: zipPath, size, version: this.appVersion };
  }

  /**
   * Retira los zips que dejó una tanda anterior.
   *
   * Mira los **dos** directorios y no solo aquel donde va a escribir: hasta esta
   * versión las dos clases de copia compartían nombre y todas acababan en
   * documentos, así que lo que hay que recuperar en un móvil que ya lleva meses
   * está ahí y no en la caché.
   *
   * Nunca lanza. Quedarse sin barrer gasta disco; que reviente la exportación
   * por no poder listar una carpeta pierde la copia, que es peor.
   */
  private async pruneArchives(prefix: string): Promise<void> {
    for (const dir of [FileSystem.documentDirectory, FileSystem.cacheDirectory]) {
      if (!dir) continue;
      const names = await FileSystem.readDirectoryAsync(dir).catch(() => []);
      for (const name of archivesToPrune(names, prefix)) {
        await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }).catch(() => {});
      }
    }
  }

  /**
   * Shares a backup ZIP file.
   */
  async shareBackup(filePath: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing not available');
    }
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/zip',
      dialogTitle: 'Share backup file',
      UTI: 'com.pkware.zip-archive',
    });
  }

  /**
   * Imports data from a ZIP file.
   */
  async importData(
    fileUri: string,
    progressCallback: (progress: number) => void,
  ): Promise<ImportInfo> {
    progressCallback(0);

    const backupDir = `${FileSystem.cacheDirectory}backup_before_import/`;
    const extractDir = `${FileSystem.cacheDirectory}import_temp/`;
    const dbCurrent = `${SQLITE_DIR}${DATABASE_NAME}`;

    // 1. Backup current state
    await FileSystem.deleteAsync(backupDir, { idempotent: true });
    await FileSystem.makeDirectoryAsync(`${backupDir}images/`, {
      intermediates: true,
    });

    await FileSystem.copyAsync({
      from: dbCurrent,
      to: `${backupDir}database.db`,
    });
    progressCallback(10);

    const existingImages = await FileSystem.readDirectoryAsync(IMAGES_DIR).catch(() => []);
    await this.copyFilesInBatches(existingImages, IMAGES_DIR, `${backupDir}images/`, (p) =>
      progressCallback(10 + p * 0.2),
    );
    progressCallback(30);

    // Save backup info
    await this.saveBackupInfo(backupDir);

    // 2. Extract the archive (native, streamed to disk)
    await FileSystem.deleteAsync(extractDir, { idempotent: true });
    await FileSystem.makeDirectoryAsync(extractDir, { intermediates: true });

    try {
      await extractZipToDirectory(fileUri, extractDir);
    } catch (error) {
      // Surface the real reason: "invalid format" hid read failures, truncated
      // reads and genuinely corrupt archives behind one useless message.
      throw new Error(
        `No se pudo extraer la copia: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    progressCallback(50);

    // 3. Validate extracted content
    const extractedDb = `${extractDir}database.db`;
    const extractedMetadata = `${extractDir}metadata.json`;

    const [dbExists, metaExists] = await Promise.all([
      FileSystem.getInfoAsync(extractedDb),
      FileSystem.getInfoAsync(extractedMetadata),
    ]);

    if (!dbExists.exists || !metaExists.exists) {
      await FileSystem.deleteAsync(extractDir, { idempotent: true });
      throw new Error('Invalid backup file format');
    }
    progressCallback(55);

    // 4. Replace database
    await FileSystem.deleteAsync(dbCurrent, { idempotent: true });
    await FileSystem.copyAsync({ from: extractedDb, to: dbCurrent });
    progressCallback(65);

    // 5. Replace images
    await FileSystem.deleteAsync(IMAGES_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });

    const extractedImagesDir = `${extractDir}images/`;
    const imagesExist = await FileSystem.getInfoAsync(extractedImagesDir);

    if (imagesExist.exists) {
      const newImages = await FileSystem.readDirectoryAsync(extractedImagesDir);
      await this.copyFilesInBatches(newImages, extractedImagesDir, IMAGES_DIR, (p) =>
        progressCallback(65 + p * 0.3),
      );
    }
    progressCallback(95);

    // 6. Cleanup
    await FileSystem.deleteAsync(extractDir, { idempotent: true });

    // Y la copia previa, que ya no protege de nada.
    //
    // Es un diario entero —base de datos y todas las fotos— en la caché, y solo
    // hacía falta mientras esta función podía fallar a medias: quien la
    // restaura es el `catch` de esta misma importación (`settings/index.tsx`),
    // no un «deshacer» que se ofrezca después. Si llegamos hasta aquí, ya no
    // hay a qué volver.
    //
    // Antes se dejaba puesta hasta la *siguiente* importación, y como la
    // migración de la v1 es una importación, en la práctica se quedaba desde el
    // primer día. Nadie la borraba: el `setTimeout` de veinticuatro horas que
    // había para eso muere con el proceso.
    await FileSystem.deleteAsync(backupDir, { idempotent: true }).catch(() => {});
    await this.forgetBackupInfo();

    progressCallback(100);

    return { date: new Date(), path: fileUri, backupPath: backupDir };
  }

  /**
   * Restores from the last backup (created before import).
   */
  async restoreBackup(): Promise<void> {
    const settings = await this.drizzleDb
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'lastBackup'));

    if (!settings.length) {
      throw new Error('No backup available');
    }

    const parsed = backupInfoSchema.safeParse(JSON.parse(settings[0]?.value || '{}'));
    if (!parsed.success) {
      throw new Error('Invalid backup path');
    }
    const backupDir = parsed.data.path;

    const backupExists = await FileSystem.getInfoAsync(backupDir);
    if (!backupExists.exists) {
      throw new Error('Backup files no longer exist');
    }

    const dbCurrent = `${SQLITE_DIR}${DATABASE_NAME}`;

    // Restore database
    await FileSystem.deleteAsync(dbCurrent, { idempotent: true });
    await FileSystem.copyAsync({
      from: `${backupDir}database.db`,
      to: dbCurrent,
    });

    // Restore images
    await FileSystem.deleteAsync(IMAGES_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });

    const imgs = await FileSystem.readDirectoryAsync(`${backupDir}images/`).catch(() => []);

    await this.copyFilesInBatches(imgs, `${backupDir}images/`, IMAGES_DIR);

    // Ya está restaurado: la copia sobra, y se borra ahora.
    //
    // Aquí había un `setTimeout` de veinticuatro horas que no llegó a
    // ejecutarse nunca — el temporizador muere con el proceso de la app, y
    // ninguna app de móvil vive un día seguido. El efecto era que un diario
    // entero se quedaba en la caché indefinidamente creyendo que estaba
    // programada su limpieza.
    await FileSystem.deleteAsync(backupDir, { idempotent: true }).catch(() => {});
    await this.forgetBackupInfo();
  }

  async getLastExportInfo(): Promise<BackupInfo | null> {
    const settings = await this.drizzleDb
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'lastExport'));

    if (!settings.length) return null;

    const parsed = exportInfoSchema.safeParse(JSON.parse(settings[0]?.value || '{}'));
    if (!parsed.success) return null;

    return {
      date: new Date(parsed.data.date),
      path: parsed.data.path,
      size: parsed.data.size ?? 0,
      version: parsed.data.version ?? '',
    };
  }

  async getLastBackupInfo(): Promise<ImportInfo | null> {
    const settings = await this.drizzleDb
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'lastBackup'));

    if (!settings.length) return null;

    const parsed = backupInfoSchema.safeParse(JSON.parse(settings[0]?.value || '{}'));
    if (!parsed.success) return null;

    return {
      date: new Date(parsed.data.date),
      path: parsed.data.path,
      backupPath: parsed.data.path,
    };
  }

  // --- Private helpers ---

  private async copyFilesInBatches(
    files: string[],
    srcDir: string,
    destDir: string,
    progressCallback?: (progress: number) => void,
  ): Promise<void> {
    const BATCH_SIZE = 20;
    const total = files.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((fn) =>
          FileSystem.copyAsync({
            from: `${srcDir}${fn}`,
            to: `${destDir}${fn}`,
          }),
        ),
      );
      progressCallback?.((i + batch.length) / total);
    }
  }

  private async saveExportInfo(zipPath: string, size: number): Promise<void> {
    const value = JSON.stringify({
      date: new Date().toISOString(),
      path: zipPath,
      size,
      version: this.appVersion,
    });

    await this.drizzleDb
      .insert(schema.appSettings)
      .values({ key: 'lastExport', value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: new Date().toISOString() },
      });
  }

  private async saveBackupInfo(backupDir: string): Promise<void> {
    const value = JSON.stringify({
      date: new Date().toISOString(),
      path: backupDir,
    });

    await this.drizzleDb
      .insert(schema.appSettings)
      .values({ key: 'lastBackup', value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: new Date().toISOString() },
      });
  }

  /**
   * Olvida la copia previa una vez borrada.
   *
   * Sin esto `restoreBackup` seguiría encontrando la fila y fallaría con
   * «Backup files no longer exist», que suena a avería cuando lo que pasa es
   * que ya no hacía falta.
   */
  private async forgetBackupInfo(): Promise<void> {
    await this.drizzleDb.delete(schema.appSettings).where(eq(schema.appSettings.key, 'lastBackup'));
  }
}
