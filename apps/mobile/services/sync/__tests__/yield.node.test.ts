import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine, type RowProgress } from '@/services/sync/engine';
import { YIELD_EVERY } from '@/services/sync/yield';

import { FakeServer } from './fake-transport';

/**
 * El sync suelta el hilo que pinta.
 *
 * **Por qué esto no se cumplía solo, teniendo `await` por todas partes.** El
 * driver de SQLite es síncrono: `drizzle-orm/expo-sqlite` usa `prepareSync` /
 * `executeSync` / `getAllSync`, así que un `await db.select()…` no espera a
 * nada — la consulta ya se ejecutó — y solo cede una **microtarea**. Las
 * microtareas se vacían enteras antes de devolver el control al bucle de
 * eventos, así que React no llega a pintar entre una fila y la siguiente.
 * Resultado: la primera sincronización de un diario importado es un bloque de
 * trabajo síncrono y la app se queda congelada hasta que acaba.
 *
 * Lo que se mide, entonces, no es que haya `await` sino que hay **turnos de
 * bucle de eventos**: se cuenta cuántas veces se despierta un `setInterval`
 * mientras corre el sync. Con el código anterior son cero, pase lo que pase;
 * comprobado revirtiendo el `yieldToUI` del motor.
 *
 * Es un test de propiedad no funcional, así que fija un orden de magnitud —«más
 * de uno»— y no un número exacto, que se rompería con cualquier refactor
 * honesto.
 */
const ACCOUNT = '11111111-1111-4111-8111-111111111111';

/** Cuántas veces el bucle de eventos pudo atender a otra cosa durante `run`. */
async function countEventLoopTurns(run: () => Promise<void>): Promise<number> {
  let turns = 0;
  const ticker = setInterval(() => {
    turns += 1;
  }, 0);
  try {
    await run();
  } finally {
    clearInterval(ticker);
  }
  return turns;
}

describe('el sync cede el hilo', () => {
  /** Bastantes más filas que el tamaño del lote, para que haya varios cortes. */
  const ROWS = YIELD_EVERY * 3;

  async function withRows(db: AppDatabase) {
    for (let i = 0; i < ROWS; i += 1) {
      await createRestaurant(db, {
        name: `Sitio ${i}`,
        comments: null,
        rating: null,
        latitude: null,
        longitude: null,
      });
    }
  }

  it('durante el push, con un diario que no cabe en un lote', async () => {
    const { db } = makeTestDb();
    await withRows(db);
    const server = new FakeServer();
    const engine = new SyncEngine(db, server.transport(), ACCOUNT);

    const turns = await countEventLoopTurns(() => engine.push());

    expect(turns).toBeGreaterThan(1);
  });

  it('durante el pull, que es donde se notaba', async () => {
    // Un móvil que restaura: todo está en el servidor y nada aquí.
    const origin = makeTestDb();
    await withRows(origin.db);
    const server = new FakeServer();
    await new SyncEngine(origin.db, server.transport(), ACCOUNT).push();

    const { db } = makeTestDb();
    const engine = new SyncEngine(db, server.transport(), ACCOUNT);

    const turns = await countEventLoopTurns(() => engine.pull());

    expect(turns).toBeGreaterThan(1);
  });

  it('y va contando por dónde va, para que se pueda enseñar', async () => {
    // Sin recuento, «Sincronizando…» durante minutos no se distingue de
    // colgado, que es justo lo que el autor vio.
    const { db } = makeTestDb();
    await withRows(db);
    const server = new FakeServer();
    const seen: RowProgress[] = [];

    await new SyncEngine(db, server.transport(), ACCOUNT, (p) => seen.push(p)).push();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((p) => p.phase === 'push' && p.table === 'restaurants')).toBe(true);
    // Avanza, no repite.
    expect(seen.at(-1)!.done).toBeGreaterThan(seen[0]!.done);
    expect(seen.at(-1)!.total).toBe(ROWS);
  });
});
