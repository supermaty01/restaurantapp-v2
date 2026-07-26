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
  /**
   * El orden del servidor. Lo pone un trigger (0017), nunca el cliente.
   *
   * Va aparte de `updated_at` porque contestan preguntas distintas:
   * `updated_at` dice *cuál de dos versiones gana* y lo escribe el reloj de
   * quien editó; `sync_seq` dice *qué ha cambiado desde que miré* y solo puede
   * decirlo el único reloj que ven todos los dispositivos. Mezclarlas hacía que
   * un móvil con el reloj atrasado escribiera filas que el otro no bajaba nunca.
   */
  sync_seq?: number;
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
   * Una página de `table` con `sync_seq > since`, ordenada por `sync_seq`.
   *
   * `since` nulo es el arranque completo: una restauración en un móvil nuevo.
   * Por eso viene paginado — un diario de años cabe en muchas filas y pedirlas
   * todas en una sola respuesta es lo que convierte una restauración en un
   * tiempo de espera sin fin y sin progreso.
   */
  pull(table: string, since: number | null, limit: number): Promise<RemoteRecord[]>;

  /** Cuántas filas vivas tiene la cuenta en el servidor, por tabla. */
  counts(): Promise<Record<string, number>>;

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
