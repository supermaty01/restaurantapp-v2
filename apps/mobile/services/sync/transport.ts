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

/**
 * A junction row: two uuids and whatever the link itself carries.
 *
 * Deliberately not a `RemoteRecord` — it has no uuid of its own, no timestamps
 * and no `deleted` flag, because a link is not a thing that can be edited or
 * soft-deleted. It exists or it does not.
 */
export type LinkRow = Record<string, unknown> & { user_id: string };

export interface SyncTransport {
  /** Upsert a batch of records into a remote table (server applies LWW). */
  push(table: string, records: RemoteRecord[]): Promise<void>;

  /**
   * Records in `table` changed strictly after `since` (an ISO cursor, or null
   * for a full bootstrap), ordered by updated_at ascending.
   */
  pull(table: string, since: string | null): Promise<RemoteRecord[]>;

  /**
   * Makes `rows` the complete set of links in `table` for the given parents.
   *
   * Delete-then-insert scoped to `parentColumn in parentUuids`: links have no
   * identity to upsert against, and a link the app removed has to disappear
   * without leaving a tombstone behind to explain it.
   */
  replaceLinks(
    table: string,
    parentColumn: string,
    parentUuids: string[],
    rows: LinkRow[],
  ): Promise<void>;

  /** Every link in `table` belonging to the given parents. */
  pullLinks(table: string, parentColumn: string, parentUuids: string[]): Promise<LinkRow[]>;
}
