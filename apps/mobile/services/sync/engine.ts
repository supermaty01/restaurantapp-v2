import { eq } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { applyRemoteRecord, toRemoteRecord } from '@/services/sync/records';
import { column, SYNC_TABLES } from '@/services/sync/tables';
import type { RemoteRecord, SyncTransport } from '@/services/sync/transport';

const CURSOR_PREFIX = 'sync_cursor_';

/**
 * The sync engine (docs/03). Reconciles the local SQLite with a remote store
 * behind the SyncTransport interface: push drains the change_log outbox, pull
 * applies remote changes with last-write-wins. All identity/FK translation is
 * in records.ts. The engine holds no Supabase dependency, so it is tested
 * against an in-memory fake transport.
 */
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
    const pending = await this.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));

    if (pending.length === 0) return;

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
        } else {
          // Hard-deleted locally: push a tombstone so the deletion propagates.
          const now = new Date().toISOString();
          records.push({
            uuid,
            user_id: this.accountUuid,
            created_at: now,
            updated_at: now,
            deleted: true,
          });
        }
      }

      await this.transport.push(cfg.name, records);
    }

    await this.db
      .update(schema.changeLog)
      .set({ synced: true })
      .where(eq(schema.changeLog.synced, false));
  }

  /** Applies remote changes into the local DB, advancing per-table cursors. */
  async pull(): Promise<void> {
    for (const cfg of SYNC_TABLES) {
      const cursor = await this.getCursor(cfg.name);
      const records = await this.transport.pull(cfg.name, cursor);
      if (records.length === 0) continue;

      for (const record of records) {
        await applyRemoteRecord(this.db, cfg, record);
      }

      const maxUpdated = records.reduce(
        (max, r) => (r.updated_at > max ? r.updated_at : max),
        cursor ?? '',
      );
      await this.setCursor(cfg.name, maxUpdated);
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
