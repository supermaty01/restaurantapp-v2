import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';

import { imagePathToUri } from '@/lib/helpers/image-paths';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { column, SYNC_TABLES } from '@/services/sync/tables';
import type { SyncTransport } from '@/services/sync/transport';

/**
 * Comparar lo que hay aquí con lo que hay en la nube.
 *
 * Hasta ahora la única señal era "última sincronización correcta", que responde
 * a *si el proceso terminó sin error* y no a la pregunta que de verdad se hace
 * quien confía su diario a una copia de seguridad: **¿está todo?**. Las dos
 * cosas se parecen lo suficiente como para confundirse y son distintas: un sync
 * puede terminar bien y dejar filas sin subir, y de hecho eso es exactamente lo
 * que pasaba con las fotos, que no tenían ni siquiera código de bajada.
 *
 * Los conteos no cuadran al segundo y no pasa nada: no es un balance contable,
 * es una respuesta a "¿puedo perder el móvil tranquilo?".
 */

export interface TableComparison {
  table: string;
  local: number;
  cloud: number;
  /** Filas locales con cambios sin enviar (la bandeja de salida). */
  pendingUpload: number;
}

export interface SyncComparison {
  tables: TableComparison[];
  /** Fotos con clave en R2 cuyo fichero no está en este teléfono. */
  photosMissing: number;
  /** Fotos de este teléfono que aún no están en R2. */
  photosPendingUpload: number;
  /** Suma de todo lo que falta por enviar. */
  totalPendingUpload: number;
  /** Filas que la nube tiene y este dispositivo no. Aproximado: ver abajo. */
  totalMissingLocally: number;
}

/** Nombres legibles, en el orden en que la gente piensa en su diario. */
export const TABLE_LABELS: Record<string, string> = {
  restaurants: 'Lugares',
  dishes: 'Platos',
  visits: 'Visitas',
  tags: 'Etiquetas',
  people: 'Personas',
  images: 'Fotos',
};

async function countRows(db: AppDatabase, cfg: (typeof SYNC_TABLES)[number]): Promise<number> {
  // `images` no tiene borrado suave: una foto quitada se borra de verdad.
  const deleted = cfg.name === 'images' ? null : column(cfg.table, 'deleted');
  const rows = deleted
    ? await db
        .select({ n: sql<number>`count(*)` })
        .from(cfg.table)
        .where(eq(deleted, false))
    : await db.select({ n: sql<number>`count(*)` }).from(cfg.table);
  return Number(rows[0]?.n ?? 0);
}

/**
 * Cuenta a los dos lados y resta.
 *
 * `totalMissingLocally` se deduce de la diferencia de conteos y no de comparar
 * uuid por uuid: traerse la lista entera de identificadores solo para pintar un
 * número gastaría casi lo mismo que sincronizar. La diferencia responde bien la
 * pregunta que importa —"la nube tiene cosas que aquí no están"— y se queda
 * corta en el caso raro de que además falten filas en el otro sentido. Por eso
 * se cuentan las dos direcciones por separado.
 */
export async function compareWithCloud(
  db: AppDatabase,
  transport: SyncTransport,
): Promise<SyncComparison> {
  const cloud = await transport.counts();

  const tables: TableComparison[] = [];
  for (const cfg of SYNC_TABLES) {
    // Las tablas de unión no tienen identidad propia ni bandeja de salida:
    // viajan con su padre, así que contarlas aparte no diría nada accionable.
    if (!(cfg.name in TABLE_LABELS)) continue;

    const pending = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.changeLog)
      .where(and(eq(schema.changeLog.tableName, cfg.name), eq(schema.changeLog.synced, false)));

    tables.push({
      table: cfg.name,
      local: await countRows(db, cfg),
      cloud: cloud[cfg.name] ?? 0,
      pendingUpload: Number(pending[0]?.n ?? 0),
    });
  }

  const stored = await db
    .select({ uuid: schema.images.uuid, path: schema.images.path })
    .from(schema.images)
    .where(and(isNotNull(schema.images.remoteKey), ne(schema.images.remoteKey, '')));

  let photosMissing = 0;
  for (const photo of stored) {
    const info = await FileSystem.getInfoAsync(imagePathToUri(photo.path || `${photo.uuid}.jpg`));
    if (!info.exists) photosMissing += 1;
  }

  const notUploaded = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.images)
    .where(sql`${schema.images.remoteKey} is null`);

  return {
    tables,
    photosMissing,
    photosPendingUpload: Number(notUploaded[0]?.n ?? 0),
    totalPendingUpload: tables.reduce((sum, t) => sum + t.pendingUpload, 0),
    totalMissingLocally: tables.reduce((sum, t) => sum + Math.max(t.cloud - t.local, 0), 0),
  };
}
