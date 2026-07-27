import { inArray } from 'drizzle-orm';

import type { AppDatabase } from '@/services/db/types';
import type { SyncTableConfig } from '@/services/sync/tables';
import { column, findTable } from '@/services/sync/tables';

/**
 * La traducción entre el id local y el uuid remoto, resuelta por lotes.
 *
 * ## Qué arregla
 *
 * `toRemoteRecord` y `applyRemoteRecord` traducían **una clave ajena a la vez**,
 * con su propio `select … limit 1`. Para `images`, que tiene tres, eso son tres
 * consultas por fila, más la de existencia en el pull, más —en el push— una
 * consulta por uuid pendiente antes de nada.
 *
 * Con las páginas de 500 del pull eso da del orden de dos mil consultas por
 * página. Y el caso que las pone todas juntas es precisamente el que peor se
 * puede permitir: restaurar un diario importado de la v1 en un móvil nuevo, que
 * son miles de filas seguidas.
 *
 * El trabajo real siempre fue pequeño: unos cientos de uuids distintos que se
 * repiten muchísimo, porque un diario tiene pocos restaurantes y muchas visitas
 * a los mismos. Lo caro no era buscar, era preguntar.
 *
 * ## Por qué un objeto y no una caché global
 *
 * Vive lo que dura una pasada de sync y se tira. Una caché que sobrevive entre
 * pasadas tendría que enterarse de las filas nuevas —que es justo lo que un sync
 * hace todo el rato— y una entrada obsoleta aquí no da un fallo: da una clave
 * ajena apuntando a la fila equivocada, en silencio y en disco. El coste de
 * empezar de cero cada pasada es una consulta por tabla.
 */
export class IdentityMap {
  /** Por tabla: uuid → id local. */
  private readonly byUuid = new Map<string, Map<string, number>>();
  /** Por tabla: id local → uuid. */
  private readonly byId = new Map<string, Map<number, string>>();
  /** Qué claves ya se preguntaron, para no volver a preguntar por las que no están. */
  private readonly askedUuids = new Map<string, Set<string>>();
  private readonly askedIds = new Map<string, Set<number>>();

  constructor(private readonly db: AppDatabase) {}

  private bucket<K, V>(store: Map<string, Map<K, V>>, table: string): Map<K, V> {
    let found = store.get(table);
    if (!found) {
      found = new Map<K, V>();
      store.set(table, found);
    }
    return found;
  }

  private asked<T>(store: Map<string, Set<T>>, table: string): Set<T> {
    let found = store.get(table);
    if (!found) {
      found = new Set<T>();
      store.set(table, found);
    }
    return found;
  }

  /**
   * Trae de golpe la traducción de todos los ids que hagan falta.
   *
   * Se llama antes de recorrer un lote, para que las lecturas de después sean
   * de memoria. Lo que ya se sabe no se vuelve a pedir.
   */
  async primeIds(cfg: SyncTableConfig, ids: number[]): Promise<void> {
    const known = this.bucket<number, string>(this.byId, cfg.name);
    const asked = this.asked<number>(this.askedIds, cfg.name);
    const missing = [...new Set(ids)].filter((id) => !asked.has(id));
    if (missing.length === 0) return;

    for (const batch of chunk(missing)) {
      const rows = (await this.db
        .select({ id: column(cfg.table, 'id'), uuid: column(cfg.table, 'uuid') })
        .from(cfg.table)
        .where(inArray(column(cfg.table, 'id'), batch))) as { id: number; uuid: string }[];

      for (const row of rows) {
        known.set(row.id, row.uuid);
        this.bucket<string, number>(this.byUuid, cfg.name).set(row.uuid, row.id);
      }
    }

    for (const id of missing) asked.add(id);
  }

  /** El mismo, al revés: uuids → ids locales. */
  async primeUuids(cfg: SyncTableConfig, uuids: string[]): Promise<void> {
    const known = this.bucket<string, number>(this.byUuid, cfg.name);
    const asked = this.asked<string>(this.askedUuids, cfg.name);
    const missing = [...new Set(uuids)].filter((uuid) => !asked.has(uuid));
    if (missing.length === 0) return;

    for (const batch of chunk(missing)) {
      const rows = (await this.db
        .select({ id: column(cfg.table, 'id'), uuid: column(cfg.table, 'uuid') })
        .from(cfg.table)
        .where(inArray(column(cfg.table, 'uuid'), batch))) as { id: number; uuid: string }[];

      for (const row of rows) {
        known.set(row.uuid, row.id);
        this.bucket<number, string>(this.byId, cfg.name).set(row.id, row.uuid);
      }
    }

    for (const uuid of missing) asked.add(uuid);
  }

  /** Precarga las claves ajenas de un lote de filas locales, tabla por tabla. */
  async primeForeignKeys(cfg: SyncTableConfig, rows: Record<string, unknown>[]): Promise<void> {
    for (const fk of cfg.foreignKeys) {
      const target = findTable(fk.references);
      if (!target) continue;

      const ids = rows
        .map((row) => row[fk.local])
        .filter((value): value is number => typeof value === 'number');
      await this.primeIds(target, ids);
    }
  }

  /** Lo mismo para el pull: las claves ajenas llegan como uuids. */
  async primeRemoteForeignKeys(
    cfg: SyncTableConfig,
    records: Record<string, unknown>[],
  ): Promise<void> {
    for (const fk of cfg.foreignKeys) {
      const target = findTable(fk.references);
      if (!target) continue;

      const uuids = records
        .map((record) => record[fk.remote])
        .filter((value): value is string => typeof value === 'string');
      await this.primeUuids(target, uuids);
    }
  }

  /**
   * El uuid de una fila local, o null.
   *
   * Sin `await`: si no está en memoria es que la fila no existe. `primeIds` deja
   * marcado lo que ya preguntó, así que una ausencia aquí es una respuesta y no
   * un fallo de caché — que es lo que permite que esto no vuelva a la base.
   */
  uuidFor(cfg: SyncTableConfig, localId: number): string | null {
    return this.byId.get(cfg.name)?.get(localId) ?? null;
  }

  /** El id local de un uuid, o null. */
  idFor(cfg: SyncTableConfig, uuid: string): number | null {
    return this.byUuid.get(cfg.name)?.get(uuid) ?? null;
  }

  /** Anota una fila recién insertada, para que el resto del lote la encuentre. */
  remember(cfg: SyncTableConfig, id: number, uuid: string): void {
    this.bucket<number, string>(this.byId, cfg.name).set(id, uuid);
    this.bucket<string, number>(this.byUuid, cfg.name).set(uuid, id);
    this.asked<number>(this.askedIds, cfg.name).add(id);
    this.asked<string>(this.askedUuids, cfg.name).add(uuid);
  }
}

/**
 * Por debajo del límite de variables de SQLite (999 en builds antiguas).
 *
 * Pasarse no va lento: la sentencia se rechaza entera, y eso convertiría una
 * optimización en una forma nueva de que un sync grande falle.
 */
const MAX_VARIABLES = 400;

function chunk<T>(items: T[]): T[][] {
  if (items.length <= MAX_VARIABLES) return [items];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += MAX_VARIABLES) {
    batches.push(items.slice(i, i + MAX_VARIABLES));
  }
  return batches;
}
