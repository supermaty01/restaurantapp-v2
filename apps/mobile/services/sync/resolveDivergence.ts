import { eq, sql } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { LINK_TABLES, SYNC_TABLES } from '@/services/sync/tables';
import type { SyncTransport } from '@/services/sync/transport';

/**
 * Qué hacer cuando el móvil y la nube tienen diarios distintos.
 *
 * Hasta aquí la estrategia era una sola y nunca se decía: combinar todo, fila a
 * fila, y que gane la fecha más nueva. Para el caso normal —un diario, un
 * dueño, dos dispositivos— está bien. Pero hay un momento en el que combinar no
 * es evidentemente lo correcto y es justo el que más duele equivocar: iniciar
 * sesión en un móvil que ya tiene un diario escrito, en una cuenta que ya tiene
 * otro. Ahí "combinar" puede significar tanto "junta mis dos mitades" como
 * "mézclame dos cosas que no tenían por qué mezclarse", y solo lo sabe quien
 * las escribió.
 *
 * Así que se pregunta **una vez**, con los conteos delante, y después el sync
 * sigue siendo automático para siempre.
 */

export type Divergence = 'merge' | 'cloud-wins' | 'device-wins';

const CURSOR_PREFIX = 'sync_cursor_';

/** Las tablas del diario, hijas antes que padres: al borrar manda la FK. */
const IN_DELETE_ORDER = [...SYNC_TABLES].reverse();

/**
 * Vacía el diario local y olvida por dónde iba el pull.
 *
 * Los cursores importan tanto como las filas: dejarlos puestos después de
 * borrar haría que el siguiente pull solo trajera *lo que cambió desde la
 * última vez*, y el diario se quedaría medio restaurado sin que nada fallara.
 * También se vacía `change_log`, o el auto-reparador reencolaría filas que ya
 * no existen.
 */
async function wipeLocalDiary(db: AppDatabase): Promise<void> {
  for (const cfg of LINK_TABLES) await db.delete(cfg.table);
  for (const cfg of IN_DELETE_ORDER) await db.delete(cfg.table);
  await db.delete(schema.changeLog);
  await db
    .delete(schema.appSettings)
    .where(sql`${schema.appSettings.key} like ${CURSOR_PREFIX + '%'}`);
}

/**
 * Vuelve a encolar **todas** las filas locales.
 *
 * `linkLocalData` solo encola las que no tienen entrada en `change_log`, que es
 * lo correcto en su caso —reparar— pero no aquí: para que este móvil se imponga
 * hay que reenviar también lo que ya se había enviado alguna vez, porque puede
 * haber sido pisado en el servidor por el otro dispositivo.
 */
async function enqueueEverything(db: AppDatabase): Promise<number> {
  await db.delete(schema.changeLog);

  let queued = 0;
  for (const cfg of SYNC_TABLES) {
    const rows = (await db.select().from(cfg.table)) as { id: number; uuid: string }[];
    for (const row of rows) {
      if (!row.uuid) continue;
      await db.insert(schema.changeLog).values({
        tableName: cfg.name,
        rowId: row.id,
        rowUuid: row.uuid,
        operation: 'update',
        synced: false,
      });
      queued += 1;
    }
  }
  return queued;
}

/**
 * Retira de la nube lo que este móvil no tiene.
 *
 * Como lápida (`deleted = true`) y no como borrado de verdad: el otro
 * dispositivo tiene que **enterarse** de que esas entradas se fueron. Un delete
 * a secas las haría desaparecer del servidor y reaparecer en el siguiente push
 * del otro móvil, que sigue teniéndolas y no tiene forma de saber que fue a
 * propósito.
 */
async function tombstoneCloudExtras(db: AppDatabase, transport: SyncTransport): Promise<number> {
  let retired = 0;

  for (const cfg of SYNC_TABLES) {
    const local = (await db.select().from(cfg.table)) as { uuid: string }[];
    const mine = new Set(local.map((row) => row.uuid));

    // Sin cursor: aquí hace falta *todo* lo que hay en el servidor, no lo que
    // cambió desde la última vez.
    let cursor: number | null = null;
    for (;;) {
      const page = await transport.pull(cfg.name, cursor, 500);
      if (page.length === 0) break;

      const extras = page.filter((record) => !record.deleted && !mine.has(record.uuid));
      if (extras.length > 0) {
        const now = new Date().toISOString();
        await transport.push(
          cfg.name,
          extras.map((record) => ({ ...record, deleted: true, updated_at: now })),
        );
        retired += extras.length;
      }

      const maxSeq: number = page.reduce<number>(
        (max, r) => (typeof r.sync_seq === 'number' && r.sync_seq > max ? r.sync_seq : max),
        cursor ?? 0,
      );
      if (cursor !== null && maxSeq <= cursor) break;
      cursor = maxSeq;
      if (page.length < 500) break;
    }
  }

  return retired;
}

export interface DivergenceOutcome {
  /** Filas encoladas para subir, si la elección fue que mande el móvil. */
  queued: number;
  /** Filas retiradas de la nube, idem. */
  retired: number;
}

/**
 * Aplica la elección. **No sincroniza**: deja el estado listo para que el
 * siguiente sync haga lo suyo, que es el que ya sabe reintentar y reportar.
 */
export async function applyDivergenceChoice(
  db: AppDatabase,
  transport: SyncTransport,
  choice: Divergence,
): Promise<DivergenceOutcome> {
  if (choice === 'merge') return { queued: 0, retired: 0 };

  if (choice === 'cloud-wins') {
    await wipeLocalDiary(db);
    return { queued: 0, retired: 0 };
  }

  const retired = await tombstoneCloudExtras(db, transport);
  const queued = await enqueueEverything(db);
  return { queued, retired };
}

/** Marca que esta cuenta ya eligió en este dispositivo, para no volver a preguntar. */
const ASKED_KEY = 'sync_divergence_asked_for';

export async function rememberChoiceMade(db: AppDatabase, accountUuid: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db
    .insert(schema.appSettings)
    .values({ key: ASKED_KEY, value: accountUuid, updatedAt })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: accountUuid, updatedAt },
    });
}

/**
 * ¿Hay que preguntar?
 *
 * Solo cuando hay entradas **a los dos lados** y nadie ha elegido todavía en
 * este dispositivo para esta cuenta. Los otros casos no son ambiguos y
 * preguntarlos sería peor que no hacerlo: un móvil vacío que entra en una cuenta
 * con diario solo puede querer restaurar, y un móvil con diario que entra en una
 * cuenta vacía solo puede querer subirlo. Una pregunta cuya respuesta es obvia
 * enseña a contestar sin leer, y esta es la única pantalla de la app capaz de
 * borrar un diario entero.
 */
export async function needsDivergenceChoice(
  db: AppDatabase,
  transport: SyncTransport,
  accountUuid: string,
): Promise<boolean> {
  if (await choiceAlreadyMade(db, accountUuid)) return false;

  const local = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.restaurants)
    .where(eq(schema.restaurants.deleted, false));
  if (Number(local[0]?.n ?? 0) === 0) return false;

  // Solo se pregunta a un dispositivo que ya tenía algo escrito *antes* de esta
  // cuenta. Si todo lo que tiene llegó por sync, no hay dos diarios: hay uno.
  const unsynced = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.changeLog)
    .where(eq(schema.changeLog.synced, false));
  if (Number(unsynced[0]?.n ?? 0) === 0) return false;

  const cloud = await transport.counts();
  return Object.values(cloud).some((n) => n > 0);
}

export async function choiceAlreadyMade(db: AppDatabase, accountUuid: string): Promise<boolean> {
  const rows = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, ASKED_KEY))
    .limit(1);
  return rows[0]?.value === accountUuid;
}
