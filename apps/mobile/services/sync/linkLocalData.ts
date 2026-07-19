import { eq } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { column, SYNC_TABLES } from '@/services/sync/tables';


/**
 * Enqueues every existing local row for the next push, so a first login uploads
 * the data the user already has (docs/04, "subir tus datos a tu cuenta"). Safe
 * to run more than once: a row already queued and unsynced is not re-queued.
 */
export async function linkLocalData(db: AppDatabase): Promise<number> {
  let queued = 0;

  for (const cfg of SYNC_TABLES) {
    const rows = (await db
      .select({ id: column(cfg.table, 'id'), uuid: column(cfg.table, 'uuid') })
      .from(cfg.table)) as { id: number; uuid: string }[];

    for (const row of rows) {
      const already = await db
        .select({ id: schema.changeLog.id })
        .from(schema.changeLog)
        .where(eq(schema.changeLog.rowUuid, row.uuid))
        .limit(1);
      if (already.length > 0) continue;

      await db.insert(schema.changeLog).values({
        tableName: cfg.name,
        rowId: row.id,
        rowUuid: row.uuid,
        operation: 'insert',
      });
      queued += 1;
    }
  }

  return queued;
}
