import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { z } from 'zod';

import { IMAGES_DIR, SQLITE_DIR } from '@/lib/helpers/fs-paths';
import { DATABASE_NAME } from '@/services/db/constants';
import * as schema from '@/services/db/schema';
import type { DrizzleDatabase } from '@/services/db/types';

import { createZip, extractZip } from './zip';

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
  async exportData(progressCallback: (progress: number) => void): Promise<BackupInfo> {
    progressCallback(0);

    const tempDir = `${FileSystem.cacheDirectory}export_temp/`;

    // Staging area: only the DB and metadata need copying; images are zipped
    // straight from their original location.
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
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

    const entries = [
      { name: 'database.db', uri: `${tempDir}database.db` },
      { name: 'metadata.json', uri: `${tempDir}metadata.json` },
      ...imageFiles.map((fn) => ({
        name: `images/${fn}`,
        uri: `${IMAGES_DIR}${fn}`,
      })),
    ];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipName = `restaurantapp_backup_${timestamp}.zip`;
    const zipPath = `${FileSystem.documentDirectory}${zipName}`;

    await createZip(entries, zipPath, (fraction) =>
      progressCallback(20 + Math.floor(fraction * 70)),
    );
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

    // 2. Extract ZIP using native module
    await FileSystem.deleteAsync(extractDir, { idempotent: true });
    await FileSystem.makeDirectoryAsync(extractDir, { intermediates: true });

    try {
      await extractZip(fileUri, extractDir, (fraction) =>
        progressCallback(30 + Math.floor(fraction * 20)),
      );
    } catch (error) {
      throw new Error('Failed to extract backup file. Invalid format.', {
        cause: error,
      });
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

    // Schedule cleanup after 24 hours
    setTimeout(
      () => {
        FileSystem.deleteAsync(backupDir, { idempotent: true }).catch(() => {});
      },
      24 * 60 * 60 * 1000,
    );
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
}
