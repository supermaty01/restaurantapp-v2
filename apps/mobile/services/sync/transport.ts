/**
 * Remote transport contract for the sync engine (docs/03).
 *
 * A record is a plain snake_case object keyed by uuid, as stored on the server.
 * The real implementation wraps supabase-js (services/sync/supabaseTransport);
 * tests use an in-memory fake. Keeping the engine behind this interface is what
 * lets the hard reconciliation logic be tested without a live Supabase.
 */

export type RemoteRecord = Record<string, unknown> & {
  uuid: string;
  updated_at: string;
  deleted: boolean;
};

export interface SyncTransport {
  /** Upsert a batch of records into a remote table (server applies LWW). */
  push(table: string, records: RemoteRecord[]): Promise<void>;

  /**
   * Records in `table` changed strictly after `since` (an ISO cursor, or null
   * for a full bootstrap), ordered by updated_at ascending.
   */
  pull(table: string, since: string | null): Promise<RemoteRecord[]>;
}
