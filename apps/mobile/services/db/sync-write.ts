import { newUuid } from '@/lib/helpers/uuid';
import { changeLog } from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { notifyLocalChange } from '@/services/sync/pending';

/**
 * Write-side sync plumbing (docs/02, docs/03). Every mutating repository routes
 * through here so that:
 *  - inserts get a uuid + created_at/updated_at,
 *  - updates bump updated_at,
 *  - and each change is appended to change_log — the sync engine's outbox.
 *
 * Keeping this in one place (instead of SQLite triggers) makes it testable and
 * keeps the sync contract in TypeScript.
 */

export type ChangeOperation = 'insert' | 'update' | 'delete';

export interface NewSyncValues {
  uuid: string;
  createdAt: string;
  updatedAt: string;
}

/** Sync columns for a brand-new row. */
export function newSyncValues(now: string = new Date().toISOString()): NewSyncValues {
  return { uuid: newUuid(), createdAt: now, updatedAt: now };
}

/** The single column an update must always touch. */
export function touchedAt(now: string = new Date().toISOString()): { updatedAt: string } {
  return { updatedAt: now };
}

/** Appends a row to the sync outbox. */
export async function recordChange(
  db: AppDatabase,
  tableName: string,
  rowId: number,
  rowUuid: string,
  operation: ChangeOperation,
): Promise<void> {
  await db.insert(changeLog).values({
    tableName,
    rowId,
    rowUuid,
    operation,
    changedAt: new Date().toISOString(),
  });

  // Le dice a useSync que hay algo que enviar. Antes, escribir una entrada y
  // quedarse en la app la dejaba en el móvil hasta el siguiente arranque.
  notifyLocalChange();
}
