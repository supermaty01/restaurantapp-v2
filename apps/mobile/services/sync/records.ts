import { eq } from 'drizzle-orm';

import { getCurrentAccount } from '@/services/db/account-store';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import type { IdentityMap } from '@/services/sync/identityMap';
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
export async function uuidForLocalId(
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
export async function localIdForUuid(
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
  /**
   * El traductor de la pasada, ya precargado.
   *
   * Opcional para que el motor pueda dárselo y los tests puedan no dárselo: sin
   * él cada clave ajena vuelve a costar una consulta, que es como estaba y sigue
   * siendo correcto, solo que lento. Ver `identityMap.ts`.
   */
  identity?: IdentityMap,
): Promise<RemoteRecord> {
  // The bookkeeping columns are as absent from imported v1 rows as any other:
  // they were added by later migrations, and importing a backup replaces the
  // SQLite file wholesale. Postgres rejects a null in each of them, and a null
  // here failed the whole push — so each gets the only answer that can be
  // right. A row with no deleted flag is not deleted; a row with no timestamps
  // is as old as the moment we noticed.
  const now = new Date().toISOString();

  const record: RemoteRecord = {
    uuid: local.uuid,
    user_id: accountUuid,
    created_at: local.createdAt ?? now,
    updated_at: local.updatedAt ?? now,
    deleted: local.deleted ?? false,
  };

  for (const scalar of cfg.scalars) {
    let value = local[scalar.local] ?? null;

    // Rows written before a column existed have no value for it. A fallback
    // fills them in at push time rather than rewriting the local database
    // during a sync, which would edit data the user never asked to change.
    if (value === null && scalar.fallback) {
      value = scalar.fallback() ?? null;
    }

    if (value === null && scalar.required) {
      // Name the row. PostgREST reports the constraint, never which record
      // broke it, so a single bad legacy row failed the push with no way to
      // find it short of exporting the database.
      console.warn(
        `[sync] ${cfg.name} #${String(local.id)} (uuid ${String(local.uuid)}) no tiene ` +
          `"${scalar.local}"; el espejo lo exige. Ábrelo en la app y complétalo.`,
      );
    }

    record[scalar.remote] = value;
  }

  for (const fk of cfg.foreignKeys) {
    const localFkId = local[fk.local] as number | null | undefined;
    const target = findTable(fk.references);

    if (localFkId == null || !target) {
      record[fk.remote] = null;
      continue;
    }

    record[fk.remote] = identity
      ? identity.uuidFor(target, localFkId)
      : await uuidForLocalId(db, target, localFkId);
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
  /** El traductor de la pasada, ya precargado. Ver `identityMap.ts`. */
  identity?: IdentityMap,
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

    if (!remoteUuid || !target) {
      values[fk.local] = null;
      continue;
    }

    values[fk.local] = identity
      ? identity.idFor(target, remoteUuid)
      : await localIdForUuid(db, target, remoteUuid);
  }

  const existing = await db
    .select({ id: column(cfg.table, 'id'), updatedAt: column(cfg.table, 'updatedAt') })
    .from(cfg.table)
    .where(eq(column(cfg.table, 'uuid'), record.uuid))
    .limit(1);

  const local = existing[0] as { id: number; updatedAt: string } | undefined;

  if (!local) {
    const inserted = (await db
      .insert(cfg.table)
      // Solo al insertar: lo que es de este dispositivo y no viaja por la red.
      // Ver `localDefaults` en tables.ts.
      //
      // `accountUuid` es de esa clase: lo que baja del servidor es, por
      // definición, de la cuenta que ha hecho el pull — RLS no deja bajar otra
      // cosa. No viene en el registro remoto y no debería: quién es el dueño lo
      // decide el servidor, no un campo que manda un cliente.
      .values({
        ...values,
        accountUuid: getCurrentAccount(),
        ...(cfg.localDefaults?.({ uuid: record.uuid }) ?? {}),
      })
      .returning({ id: column(cfg.table, 'id') })) as { id: number }[];

    // Mark it as already-synced in the outbox.
    //
    // Not bookkeeping for its own sake: `linkLocalData` enqueues every row that
    // has no change_log entry, which is how a first login uploads a diary that
    // predates the account. A row that arrived by *pull* looks identical to it,
    // so the next push would send it straight back — and with it, this device's
    // idea of the row's links. A link another device had just removed would be
    // re-asserted and reappear. An entry that is already `synced` makes the
    // row's provenance visible without pushing anything.
    const id = inserted[0]?.id;
    if (id !== undefined) {
      // El traductor tiene que enterarse de la fila que acaba de nacer. Las
      // tablas se recorren en orden de dependencia, así que hoy el padre ya está
      // escrito cuando llega el hijo y una consulta lo encontraría igual — pero
      // una caché que solo es correcta mientras nadie cambie ese orden es una
      // trampa esperando, y lo que produce al fallar no es un error: es una
      // clave ajena apuntando a otro sitio, en disco y en silencio.
      identity?.remember(cfg, id, record.uuid);

      await db.insert(schema.changeLog).values({
        tableName: cfg.name,
        rowId: id,
        rowUuid: record.uuid,
        operation: 'insert',
        synced: true,
      });
    }
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

/**
 * The record pushed for a row that no longer exists locally.
 *
 * A tombstone only has to carry `deleted: true` — nothing reads its other
 * fields. But Postgres still enforces its NOT NULL columns on the way in, and
 * building the tombstone from scratch skipped every one of them, so deleting a
 * visit failed the push with the same "violates not-null constraint" as a row
 * that had never been filled in. The required columns are satisfied here the
 * same way live rows satisfy them.
 */
export function toTombstoneRecord(
  cfg: SyncTableConfig,
  uuid: string,
  accountUuid: string,
): RemoteRecord {
  const now = new Date().toISOString();

  const record: RemoteRecord = {
    uuid,
    user_id: accountUuid,
    created_at: now,
    updated_at: now,
    deleted: true,
  };

  for (const scalar of cfg.scalars) {
    if (!scalar.required) continue;
    // A placeholder is fine and never shown: the row is gone, and the mirror
    // keeps it only so the deletion reaches other devices.
    record[scalar.remote] = scalar.fallback?.() ?? '—';
  }

  return record;
}
