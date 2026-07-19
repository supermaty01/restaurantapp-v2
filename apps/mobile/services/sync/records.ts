import { eq } from 'drizzle-orm';

import type { AppDatabase } from '@/services/db/types';
import type { SyncTableConfig } from '@/services/sync/tables';
import { column, findTable } from '@/services/sync/tables';
import type { RemoteRecord } from '@/services/sync/transport';

/**
 * Translation between local rows (integer PK + FKs) and remote records (uuid PK
 * + FKs), the heart of the sync engine. See docs/03 for why identity is split.
 */

interface LocalRowShape {
  id: number;
  uuid: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  [key: string]: unknown;
}

/** uuid of a referenced row given its local id (for push). */
async function uuidForLocalId(
  db: AppDatabase,
  cfg: SyncTableConfig,
  localId: number,
): Promise<string | null> {
  const rows = await db
    .select({ uuid: column(cfg.table, 'uuid') })
    .from(cfg.table)
    .where(eq(column(cfg.table, 'id'), localId))
    .limit(1);
  return (rows[0]?.uuid as string | undefined) ?? null;
}

/** local id of a referenced row given its uuid (for pull). */
async function localIdForUuid(
  db: AppDatabase,
  cfg: SyncTableConfig,
  uuid: string,
): Promise<number | null> {
  const rows = await db
    .select({ id: column(cfg.table, 'id') })
    .from(cfg.table)
    .where(eq(column(cfg.table, 'uuid'), uuid))
    .limit(1);
  return (rows[0]?.id as number | undefined) ?? null;
}

/** Builds the remote record for a local row (FK local ids → uuids). */
export async function toRemoteRecord(
  db: AppDatabase,
  cfg: SyncTableConfig,
  local: LocalRowShape,
  accountUuid: string,
): Promise<RemoteRecord> {
  const record: RemoteRecord = {
    uuid: local.uuid,
    user_id: accountUuid,
    created_at: local.createdAt,
    updated_at: local.updatedAt,
    deleted: local.deleted,
  };

  for (const scalar of cfg.scalars) {
    record[scalar.remote] = local[scalar.local] ?? null;
  }

  for (const fk of cfg.foreignKeys) {
    const localFkId = local[fk.local] as number | null | undefined;
    const target = findTable(fk.references);
    record[fk.remote] =
      localFkId != null && target ? await uuidForLocalId(db, target, localFkId) : null;
  }

  return record;
}

/**
 * Applies a remote record to the local DB with last-write-wins (docs/03):
 * insert if unseen, update only if strictly newer, skip stale writes. FK uuids
 * are translated back to local ids; an unresolved FK becomes null rather than
 * dangling.
 */
export async function applyRemoteRecord(
  db: AppDatabase,
  cfg: SyncTableConfig,
  record: RemoteRecord,
): Promise<void> {
  const values: Record<string, unknown> = {
    uuid: record.uuid,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deleted: record.deleted,
  };

  for (const scalar of cfg.scalars) {
    values[scalar.local] = record[scalar.remote] ?? null;
  }

  for (const fk of cfg.foreignKeys) {
    const remoteUuid = record[fk.remote] as string | null | undefined;
    const target = findTable(fk.references);
    values[fk.local] = remoteUuid && target ? await localIdForUuid(db, target, remoteUuid) : null;
  }

  const existing = await db
    .select({ id: column(cfg.table, 'id'), updatedAt: column(cfg.table, 'updatedAt') })
    .from(cfg.table)
    .where(eq(column(cfg.table, 'uuid'), record.uuid))
    .limit(1);

  const local = existing[0] as { id: number; updatedAt: string } | undefined;

  if (!local) {
    await db.insert(cfg.table).values(values);
    return;
  }

  // Last-write-wins: ISO-8601 UTC compares lexicographically.
  if (record.updated_at > local.updatedAt) {
    await db
      .update(cfg.table)
      .set(values)
      .where(eq(column(cfg.table, 'id'), local.id));
  }
}
