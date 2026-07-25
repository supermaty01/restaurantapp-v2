import { eq, inArray } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { linkLocalData } from '@/services/sync/linkLocalData';
import { applyLinks, collectLinks, parentIdsByUuid } from '@/services/sync/links';
import { applyRemoteRecord, toRemoteRecord, toTombstoneRecord } from '@/services/sync/records';
import { column, linksOf, SYNC_TABLES } from '@/services/sync/tables';
import type { LinkRow, RemoteRecord, SyncTransport } from '@/services/sync/transport';

const CURSOR_PREFIX = 'sync_cursor_';

/**
 * The sync engine (docs/03). Reconciles the local SQLite with a remote store
 * behind the SyncTransport interface: push drains the change_log outbox, pull
 * applies remote changes with last-write-wins. All identity/FK translation is
 * in records.ts. The engine holds no Supabase dependency, so it is tested
 * against an in-memory fake transport.
 */
/** Rows per push request. */
const PUSH_BATCH = 200;

/**
 * Ids per `synced = true` statement.
 *
 * Well under SQLite's variable limit (999 on older builds, 32766 on newer):
 * there is nothing to gain from being close to it, and the failure mode is the
 * whole sync dying rather than a slow query.
 */
const MARK_BATCH = 400;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length <= size) return items.length > 0 ? [items] : [];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * The server saying "this row is not yours".
 *
 * Postgres phrases an ON CONFLICT DO UPDATE that fails the owner policy as a
 * *new row* violating the USING expression, which reads like the incoming row
 * is malformed when the actual problem is the row already sitting there.
 */
function isOwnershipError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('row-level security policy');
}

export class SyncEngine {
  constructor(
    private readonly db: AppDatabase,
    private readonly transport: SyncTransport,
    /** The logged-in account's uuid; stamped on every pushed record. */
    private readonly accountUuid: string,
  ) {}

  async sync(): Promise<void> {
    await this.push();
    await this.pull();
  }

  /** Sends local changes to the server, then marks them synced. */
  async push(): Promise<void> {
    // Self-heal first: a row whose change_log entry was never written (the two
    // writes aren't transactional — see linkLocalData) would otherwise never
    // reach the server.
    await linkLocalData(this.db);

    const pending = await this.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));

    if (pending.length === 0) return;

    const pushedIds: number[] = [];
    /** Parents that moved this pass, per table: whose links need resending. */
    const touched = new Map<string, { id: number; uuid: string }[]>();

    // Dependency order: FK targets (restaurants) push before children (dishes).
    for (const cfg of SYNC_TABLES) {
      const forTable = pending.filter((c) => c.tableName === cfg.name);
      if (forTable.length === 0) continue;

      const uuids = [...new Set(forTable.map((c) => c.rowUuid))];
      const records: RemoteRecord[] = [];

      for (const uuid of uuids) {
        const rows = await this.db
          .select()
          .from(cfg.table)
          .where(eq(column(cfg.table, 'uuid'), uuid))
          .limit(1);
        const local = rows[0] as
          | (Record<string, unknown> & {
              id: number;
              uuid: string;
              createdAt: string;
              updatedAt: string;
              deleted: boolean;
            })
          | undefined;

        if (local) {
          records.push(await toRemoteRecord(this.db, cfg, local, this.accountUuid));
          const list = touched.get(cfg.name) ?? [];
          list.push({ id: local.id, uuid: local.uuid });
          touched.set(cfg.name, list);
        } else {
          // Hard-deleted locally: push a tombstone so the deletion propagates.
          records.push(toTombstoneRecord(cfg, uuid, this.accountUuid));
        }
      }

      // In batches: a first sync of an imported diary pushes thousands of rows,
      // and one request carrying all of them is a body no free tier enjoys.
      const disowned = new Set<string>();
      for (const batch of chunk(records, PUSH_BATCH)) {
        for (const uuid of await this.pushBatch(cfg.name, batch)) disowned.add(uuid);
      }

      // A row the server says is not ours never becomes ours by trying again,
      // so its outbox entry is retired along with the rest. It stays in the
      // local database: deleting rows to recover from a sync bug is how a
      // backup turns into a smaller backup.
      if (disowned.size > 0) {
        console.warn(
          `[sync] ${disowned.size} fila(s) de ${cfg.name} pertenecen a otra cuenta y no se ` +
            `enviarán: ${[...disowned].join(', ')}. Llegaron a este dispositivo por un pull sin ` +
            `filtrar (corregido); si aparecen en tu diario, no son tuyas.`,
        );
      }
      // Mark exactly the entries that were just sent. A blanket
      // `where(synced = false)` would also swallow changes enqueued *during*
      // this push (and any table not in SYNC_TABLES), losing them silently.
      pushedIds.push(...forTable.map((c) => c.id));
    }

    // Links last, once every parent and every child row exists on the server.
    // Sending them alongside their parent would push a dish_visit before the
    // dish, and the mirror's foreign keys would reject the batch.
    await this.pushLinks(touched);

    // Also in batches: `inArray` becomes one bound parameter per id, and past
    // SQLite's variable limit the statement is rejected outright rather than
    // running slowly. A first sync sends one entry per existing row, so the
    // count is bounded by the diary's size and not by anything we control.
    for (const batch of chunk(pushedIds, MARK_BATCH)) {
      await this.db
        .update(schema.changeLog)
        .set({ synced: true })
        .where(inArray(schema.changeLog.id, batch));
    }
  }

  /**
   * Sends one batch, and works out what to do when the server refuses it.
   *
   * Returns the uuids the server says belong to someone else. A single
   * unpushable row used to fail the whole batch and, with it, every later
   * table — so one leaked row could stop a diary syncing forever. Splitting the
   * batch on failure isolates the bad rows and lets the rest through.
   *
   * Only ownership rejections are absorbed. Anything else is rethrown: a
   * not-null violation or a dead connection is a real failure, and swallowing
   * those is how a sync reports success while silently dropping data.
   */
  private async pushBatch(table: string, batch: RemoteRecord[]): Promise<string[]> {
    try {
      await this.transport.push(table, batch);
      return [];
    } catch (error) {
      if (!isOwnershipError(error) || batch.length === 0) throw error;

      const disowned: string[] = [];
      for (const record of batch) {
        try {
          await this.transport.push(table, [record]);
        } catch (single) {
          if (!isOwnershipError(single)) throw single;
          disowned.push(record.uuid);
        }
      }
      return disowned;
    }
  }

  /** Applies remote changes into the local DB, advancing per-table cursors. */
  async pull(): Promise<void> {
    const touched = new Map<string, string[]>();

    for (const cfg of SYNC_TABLES) {
      const cursor = await this.getCursor(cfg.name);
      const records = await this.transport.pull(cfg.name, cursor);
      if (records.length === 0) continue;

      for (const record of records) {
        await applyRemoteRecord(this.db, cfg, record);
      }
      touched.set(
        cfg.name,
        records.filter((r) => !r.deleted).map((r) => r.uuid),
      );

      const maxUpdated = records.reduce(
        (max, r) => (r.updated_at > max ? r.updated_at : max),
        cursor ?? '',
      );
      await this.setCursor(cfg.name, maxUpdated);
    }

    await this.pullLinks(touched);
  }

  /**
   * Resends the complete link set of every parent that moved.
   *
   * Scoped to the parents in this pass rather than the whole diary: a full
   * replace is cheap for one row and a rewrite of every junction table for a
   * device that has thousands.
   */
  private async pushLinks(touched: Map<string, { id: number; uuid: string }[]>): Promise<void> {
    for (const [parentTable, parents] of touched) {
      for (const cfg of linksOf(parentTable)) {
        const rows: LinkRow[] = [];
        for (const parent of parents) {
          rows.push(
            ...(await collectLinks(this.db, cfg, parent.id, parent.uuid, this.accountUuid)),
          );
        }
        for (const batch of chunk(
          parents.map((p) => p.uuid),
          PUSH_BATCH,
        )) {
          const scoped = rows.filter((row) => batch.includes(row[cfg.parent.remote] as string));
          await this.transport.replaceLinks(cfg.name, cfg.parent.remote, batch, scoped);
        }
      }
    }
  }

  /** The mirror image: whatever the server says a pulled parent's links are. */
  private async pullLinks(touched: Map<string, string[]>): Promise<void> {
    for (const [parentTable, uuids] of touched) {
      if (uuids.length === 0) continue;

      for (const cfg of linksOf(parentTable)) {
        const ids = await parentIdsByUuid(this.db, parentTable, uuids);
        if (ids.size === 0) continue;

        for (const batch of chunk([...ids.keys()], PUSH_BATCH)) {
          const remote = await this.transport.pullLinks(cfg.name, cfg.parent.remote, batch);

          const byParent = new Map<string, LinkRow[]>();
          for (const link of remote) {
            const key = link[cfg.parent.remote];
            if (typeof key !== 'string') continue;
            byParent.set(key, [...(byParent.get(key) ?? []), link]);
          }

          // Every parent in the batch, not only those with links: a parent
          // whose last link was removed elsewhere comes back with none, and
          // that absence is exactly what has to be applied.
          for (const uuid of batch) {
            const id = ids.get(uuid);
            if (id === undefined) continue;
            await applyLinks(this.db, cfg, id, byParent.get(uuid) ?? []);
          }
        }
      }
    }
  }

  private async getCursor(table: string): Promise<string | null> {
    const rows = await this.db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, CURSOR_PREFIX + table))
      .limit(1);
    return rows[0]?.value ?? null;
  }

  private async setCursor(table: string, value: string): Promise<void> {
    const key = CURSOR_PREFIX + table;
    const updatedAt = new Date().toISOString();
    await this.db
      .insert(schema.appSettings)
      .values({ key, value, updatedAt })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt } });
  }
}
