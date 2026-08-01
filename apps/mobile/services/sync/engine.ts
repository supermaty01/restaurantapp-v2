import { eq, inArray } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { IdentityMap } from '@/services/sync/identityMap';
import { linkLocalData } from '@/services/sync/linkLocalData';
import { applyLinks, collectLinks, parentIdsByUuid } from '@/services/sync/links';
import { applyRemoteRecord, toRemoteRecord, toTombstoneRecord } from '@/services/sync/records';
import { column, linksOf, SYNC_TABLES } from '@/services/sync/tables';
import type { LinkRow, RemoteRecord, SyncTransport } from '@/services/sync/transport';
import { yieldToUI, YIELD_EVERY } from '@/services/sync/yield';

const CURSOR_PREFIX = 'sync_cursor_';

/**
 * Por dónde va la pasada, para que la interfaz pueda decirlo.
 *
 * `total` es null en el pull: no se sabe cuántas filas hay al otro lado hasta
 * que se acaban las páginas, y fingir un total que luego crece es peor que no
 * darlo. La pantalla enseña un recuento que sube, que ya distingue «avanzando»
 * de «colgado», que es la pregunta que se hace quien mira.
 */
export interface RowProgress {
  phase: 'push' | 'pull';
  /** La tabla en curso, con su nombre SQL. */
  table: string;
  done: number;
  total: number | null;
}

/**
 * The sync engine (docs/03). Reconciles the local SQLite with a remote store
 * behind the SyncTransport interface: push drains the change_log outbox, pull
 * applies remote changes with last-write-wins. All identity/FK translation is
 * in records.ts. The engine holds no Supabase dependency, so it is tested
 * against an in-memory fake transport.
 */
/** Rows per push request. */
const PUSH_BATCH = 200;

/** Filas por página de pull. Ver `pull()`. */
const PULL_PAGE = 500;

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
    /** Se llama mientras se mueven filas. Ver `RowProgress`. */
    private readonly onProgress?: (progress: RowProgress) => void,
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

    let pushed = 0;
    const pushedIds: number[] = [];
    /** Parents that moved this pass, per table: whose links need resending. */
    const touched = new Map<string, { id: number; uuid: string }[]>();
    /** La traducción id↔uuid de esta pasada. Ver `identityMap.ts`. */
    const identity = new IdentityMap(this.db);

    // Dependency order: FK targets (restaurants) push before children (dishes).
    for (const cfg of SYNC_TABLES) {
      const forTable = pending.filter((c) => c.tableName === cfg.name);
      if (forTable.length === 0) continue;

      const uuids = [...new Set(forTable.map((c) => c.rowUuid))];
      const records: RemoteRecord[] = [];

      /**
       * Las filas del lote, de una vez.
       *
       * Antes esto era un `select … limit 1` **por uuid**. En un diario
       * importado de la v1 la primera subida tiene una entrada por fila
       * existente, así que eran miles de consultas seguidas antes de mandar
       * nada. El trabajo era el mismo; lo caro era preguntarlo de uno en uno.
       */
      type LocalRow = Record<string, unknown> & {
        id: number;
        uuid: string;
        createdAt: string;
        updatedAt: string;
        deleted: boolean;
      };

      const found = new Map<string, LocalRow>();
      for (const batch of chunk(uuids, MARK_BATCH)) {
        const rows = (await this.db
          .select()
          .from(cfg.table)
          .where(inArray(column(cfg.table, 'uuid'), batch))) as LocalRow[];
        for (const row of rows) found.set(row.uuid, row);
      }

      // Y las claves ajenas de todas ellas, también de una vez.
      await identity.primeForeignKeys(cfg, [...found.values()]);

      for (const uuid of uuids) {
        const local = found.get(uuid);

        if (local) {
          records.push(await toRemoteRecord(this.db, cfg, local, this.accountUuid, identity));
          const list = touched.get(cfg.name) ?? [];
          list.push({ id: local.id, uuid: local.uuid });
          touched.set(cfg.name, list);
        } else {
          // Hard-deleted locally: push a tombstone so the deletion propagates.
          records.push(toTombstoneRecord(cfg, uuid, this.accountUuid));
        }

        // Armar cada registro lee SQLite, y SQLite aquí es síncrono: sin ceder,
        // un diario importado construye miles de registros sin soltar el hilo
        // que pinta. Ver `yield.ts`.
        pushed += 1;
        if (pushed % YIELD_EVERY === 0) {
          this.onProgress?.({
            phase: 'push',
            table: cfg.name,
            done: pushed,
            total: pending.length,
          });
          await yieldToUI();
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

  /**
   * Applies remote changes into the local DB, advancing per-table cursors.
   *
   * Pagina hasta agotar cada tabla en vez de pedir una sola vez: una
   * restauración en un móvil nuevo baja el diario entero, y ese caso es
   * precisamente el que no puede depender de que quepa en una respuesta.
   *
   * El cursor solo avanza **después** de aplicar la página. Si el proceso muere
   * a la mitad, la siguiente pasada repite esa página; aplicar dos veces la
   * misma fila es inofensivo (se compara por uuid y por fecha), mientras que
   * adelantar el cursor y morir después se salta filas para siempre.
   */
  async pull(): Promise<void> {
    let applied = 0;
    const touched = new Map<string, string[]>();
    /** La traducción id↔uuid de esta pasada. Ver `identityMap.ts`. */
    const identity = new IdentityMap(this.db);

    for (const cfg of SYNC_TABLES) {
      let cursor = await this.getCursor(cfg.name);
      const seen: string[] = [];

      for (;;) {
        const records = await this.transport.pull(cfg.name, cursor, PULL_PAGE);
        if (records.length === 0) break;

        // Las claves ajenas de la página entera, de una vez. Antes cada fila
        // pedía las suyas por separado: con `images`, que tiene tres, una
        // página de quinientas eran mil quinientas consultas para traducir unos
        // pocos cientos de uuids distintos.
        await identity.primeRemoteForeignKeys(cfg, records);

        for (const [index, record] of records.entries()) {
          await applyRemoteRecord(this.db, cfg, record, identity);

          // Igual que en el push, y aquí es donde de verdad se notaba: aplicar
          // una página entera son cientos de escrituras síncronas seguidas.
          if ((index + 1) % YIELD_EVERY === 0) {
            this.onProgress?.({
              phase: 'pull',
              table: cfg.name,
              done: applied + index + 1,
              total: null,
            });
            await yieldToUI();
          }
        }
        applied += records.length;
        this.onProgress?.({ phase: 'pull', table: cfg.name, done: applied, total: null });
        seen.push(...records.filter((r) => !r.deleted).map((r) => r.uuid));

        const maxSeq = records.reduce(
          (max, r) => (typeof r.sync_seq === 'number' && r.sync_seq > max ? r.sync_seq : max),
          cursor ?? 0,
        );

        // Sin avance no hay página siguiente que pedir, y repetir la misma
        // consulta sería un bucle infinito. Pasa si el servidor todavía no
        // tiene la columna (0017 sin aplicar): mejor una pasada de más que la
        // app colgada.
        if (cursor !== null && maxSeq <= cursor) break;
        cursor = maxSeq;
        await this.setCursor(cfg.name, maxSeq);

        if (records.length < PULL_PAGE) break;
      }

      if (seen.length > 0) touched.set(cfg.name, seen);
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
          // `Set` y no `Array.includes`: dentro de un `filter` sobre todas las
          // uniones, `includes` recorre el lote entero por cada fila. Con un
          // diario de los grandes eso es el producto de dos números grandes
          // para responder una pregunta de pertenencia.
          const inBatch = new Set(batch);
          const scoped = rows.filter((row) => inBatch.has(row[cfg.parent.remote] as string));
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

  /**
   * El cursor guardado, o null si no hay ninguno utilizable.
   *
   * Hasta 0017 aquí vivía un ISO-8601 (`2026-07-25T…`). `Number()` sobre eso da
   * `NaN`, y devolver `NaN` como cursor haría que `sync_seq > NaN` no
   * devolviera nada: el dispositivo dejaría de bajar cambios para siempre. Un
   * valor que no es un número se trata como "no hay cursor", así que un móvil
   * que venga de la versión anterior hace un pull completo una vez y sigue.
   * Volver a aplicar filas que ya tiene es inofensivo; no volver a mirar, no.
   */
  private async getCursor(table: string): Promise<number | null> {
    const rows = await this.db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, CURSOR_PREFIX + table))
      .limit(1);

    const stored = rows[0]?.value;
    if (stored === undefined || stored === null) return null;

    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async setCursor(table: string, value: number): Promise<void> {
    const key = CURSOR_PREFIX + table;
    const updatedAt = new Date().toISOString();
    await this.db
      .insert(schema.appSettings)
      .values({ key, value: String(value), updatedAt })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value: String(value), updatedAt },
      });
  }
}
