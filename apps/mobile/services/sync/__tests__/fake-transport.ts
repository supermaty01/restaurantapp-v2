import type { RemoteRecord, SyncTransport } from '@/services/sync/transport';

/**
 * In-memory stand-in for the Supabase mirror, used to test the sync engine
 * without a live server. Applies the same last-write-wins guard the server
 * trigger does (docs/03), so two engines pointed at one FakeServer behave like
 * two devices syncing through Supabase.
 */
export class FakeServer {
  private tables = new Map<string, Map<string, RemoteRecord>>();

  private tableOf(name: string): Map<string, RemoteRecord> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  upsert(table: string, records: RemoteRecord[]): void {
    const store = this.tableOf(table);
    for (const record of records) {
      const existing = store.get(record.uuid);
      // Server-side LWW: keep the newer row.
      if (existing && existing.updated_at > record.updated_at) continue;
      store.set(record.uuid, { ...record });
    }
  }

  since(table: string, cursor: string | null): RemoteRecord[] {
    const rows = [...this.tableOf(table).values()].filter(
      (r) => cursor === null || r.updated_at > cursor,
    );
    return rows.sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1)).map((r) => ({ ...r }));
  }

  /** A transport bound to this server (one per simulated device). */
  transport(): SyncTransport {
    return {
      push: async (table, records) => {
        this.upsert(table, records);
      },
      pull: async (table, cursor) => this.since(table, cursor),
    };
  }

  count(table: string): number {
    return this.tableOf(table).size;
  }
}
