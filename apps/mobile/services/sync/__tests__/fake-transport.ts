import type { LinkRow, RemoteRecord, SyncTransport } from '@/services/sync/transport';

/**
 * In-memory stand-in for the Supabase mirror, used to test the sync engine
 * without a live server. Applies the same last-write-wins guard the server
 * trigger does (docs/03), so two engines pointed at one FakeServer behave like
 * two devices syncing through Supabase.
 */
export class FakeServer {
  private tables = new Map<string, Map<string, RemoteRecord>>();
  /** Junctions, kept as flat lists: a link has no key to store it under. */
  private links = new Map<string, LinkRow[]>();

  /**
   * El equivalente de la secuencia `sync_seq` de 0017.
   *
   * Modelarla aquí no es decoración: es lo que hace que el fake se comporte como
   * el servidor de verdad en lo único que importaba del bug. Mientras el fake
   * paginaba por `updated_at` —igual que el motor— los dos compartían la misma
   * suposición equivocada y el test no podía fallar aunque el bug estuviera.
   */
  private seq = 0;

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
      // El trigger sella toda fila que entra, sea alta o edición, con el reloj
      // del servidor y no con el de quien escribe.
      this.seq += 1;
      store.set(record.uuid, { ...record, sync_seq: this.seq });
    }
  }

  since(table: string, cursor: number | null, limit = 500): RemoteRecord[] {
    const rows = [...this.tableOf(table).values()].filter(
      (r) => cursor === null || (r.sync_seq ?? 0) > cursor,
    );
    return rows
      .sort((a, b) => (a.sync_seq ?? 0) - (b.sync_seq ?? 0))
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }

  replaceLinks(table: string, parentColumn: string, parentUuids: string[], rows: LinkRow[]): void {
    const kept = (this.links.get(table) ?? []).filter(
      (row) => !parentUuids.includes(row[parentColumn] as string),
    );
    this.links.set(table, [...kept, ...rows.map((r) => ({ ...r }))]);
  }

  linksFor(table: string, parentColumn: string, parentUuids: string[]): LinkRow[] {
    return (this.links.get(table) ?? [])
      .filter((row) => parentUuids.includes(row[parentColumn] as string))
      .map((r) => ({ ...r }));
  }

  linkCount(table: string): number {
    return (this.links.get(table) ?? []).length;
  }

  /** A transport bound to this server (one per simulated device). */
  transport(): SyncTransport {
    return {
      push: async (table, records) => {
        this.upsert(table, records);
      },
      pull: async (table, cursor, limit) => this.since(table, cursor, limit),
      counts: async () => {
        const totals: Record<string, number> = {};
        for (const [name, rows] of this.tables) {
          totals[name] = [...rows.values()].filter((r) => !r.deleted).length;
        }
        return totals;
      },
      replaceLinks: async (table, parentColumn, parentUuids, rows) => {
        this.replaceLinks(table, parentColumn, parentUuids, rows);
      },
      pullLinks: async (table, parentColumn, parentUuids) =>
        this.linksFor(table, parentColumn, parentUuids),
    };
  }

  count(table: string): number {
    return this.tableOf(table).size;
  }
}
