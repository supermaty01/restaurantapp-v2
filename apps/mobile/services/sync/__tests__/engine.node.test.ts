import { eq } from 'drizzle-orm';

import { createDish } from '@/features/dishes/repositories/dishRepository';
import {
  createRestaurant,
  softDeleteRestaurant,
} from '@/features/restaurants/repositories/restaurantRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine } from '@/services/sync/engine';
import type { RemoteRecord } from '@/services/sync/transport';

import { FakeServer } from './fake-transport';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

function engineFor(db: AppDatabase, server: FakeServer) {
  return new SyncEngine(db, server.transport(), ACCOUNT);
}

async function restaurantByName(db: AppDatabase, name: string) {
  const rows = await db.select().from(schema.restaurants).where(eq(schema.restaurants.name, name));
  return rows[0];
}

/** Edits a restaurant at a fixed timestamp and enqueues it for sync, the way a
 * repository write would. Used to drive deterministic conflict scenarios. */
async function editAt(db: AppDatabase, id: number, rating: number, updatedAt: string) {
  const [row] = await db
    .update(schema.restaurants)
    .set({ rating, updatedAt })
    .where(eq(schema.restaurants.id, id))
    .returning({ uuid: schema.restaurants.uuid });
  await db.insert(schema.changeLog).values({
    tableName: 'restaurants',
    rowId: id,
    rowUuid: row!.uuid,
    operation: 'update',
  });
}

describe('SyncEngine', () => {
  /*
   * El fallo que hacía que dos dispositivos perdieran filas en silencio.
   *
   * El cursor de pull era `max(updated_at)` de lo recibido, y `updated_at` lo
   * escribe el móvil que editó, no el servidor. Basta con que el reloj del
   * segundo dispositivo vaya por detrás —desfase normal entre dos teléfonos, un
   * cambio de zona horaria, uno que estuvo sin red— para que sus filas lleguen
   * al servidor con una fecha anterior al cursor que el primero ya guardó, y
   * entonces el primero **no las baja nunca**. Ni error, ni reintento.
   *
   * Desde 0017 la paginación va por `sync_seq`, que sella el servidor y es
   * monótona, así que el reloj de quien escribe deja de decidir qué se ve.
   * `updated_at` sigue decidiendo qué versión gana, que es otra pregunta.
   */
  it('baja las filas de otro dispositivo aunque su reloj vaya atrasado', async () => {
    const server = new FakeServer();
    const a = makeTestDb();
    const b = makeTestDb();

    // A escribe con la hora "buena" y sincroniza. Su cursor queda en esa fecha.
    await createRestaurant(a.db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });
    const guadalupe = await restaurantByName(a.db, 'Guadalupe');
    await editAt(a.db, guadalupe!.id, 5, '2026-07-26T12:00:00.000Z');
    await engineFor(a.db, server).sync();

    // B tiene el reloj una hora atrasado y registra su propia comida.
    await createRestaurant(b.db, {
      name: 'Ichiran',
      comments: null,
      rating: 4,
      latitude: null,
      longitude: null,
    });
    const ichiran = await restaurantByName(b.db, 'Ichiran');
    await editAt(b.db, ichiran!.id, 4, '2026-07-26T11:00:00.000Z');
    await engineFor(b.db, server).push();

    // A vuelve a mirar. Con el cursor viejo, 11:00 < 12:00 y esta fila no
    // existía para A: el restaurante se quedaba en el otro móvil para siempre.
    await engineFor(a.db, server).pull();

    expect(await restaurantByName(a.db, 'Ichiran')).toBeDefined();
  });

  /*
   * Restaurar en un móvil nuevo se caía en la última tabla.
   *
   * `images.path` es la ruta del fichero en *este* teléfono, así que no se
   * sincroniza — la ruta de otro dispositivo no significa nada aquí. Pero la
   * columna es `not null`, y nadie rellenaba nada al insertar una fila que
   * llegaba del servidor: `NOT NULL constraint failed: images.path`.
   *
   * Y `images` es la última tabla escalar del registro, así que ese error se
   * llevaba por delante el final del pull: la restauración se quedaba sin fotos
   * **y sin uniones** (etiquetas, platos por visita, personas), porque
   * `pullLinks` corre después y no llegaba nunca. Cada sync terminaba en error.
   */
  it('restaura una foto en un móvil vacío sin romper el resto del pull', async () => {
    const server = new FakeServer();
    const a = makeTestDb();
    const b = makeTestDb();

    await createRestaurant(a.db, {
      name: 'Ichiran',
      comments: null,
      rating: 4,
      latitude: null,
      longitude: null,
    });
    const ichiran = await restaurantByName(a.db, 'Ichiran');
    await a.db.insert(schema.images).values({
      path: 'foto-local-del-movil-a.jpg',
      remoteKey: 'clave-en-r2',
      restaurantId: ichiran!.id,
      uuid: 'img-0000-4000-8000-000000000001',
      createdAt: '2026-07-26T10:00:00.000Z',
      updatedAt: '2026-07-26T10:00:00.000Z',
    });
    await engineFor(a.db, server).sync();

    await engineFor(b.db, server).pull();

    const [restored] = await b.db.select().from(schema.images);
    expect(restored).toBeDefined();
    expect(restored?.remoteKey).toBe('clave-en-r2');
    // Derivada del uuid, no heredada del otro móvil: es donde la descarga la
    // dejará, así que "¿está bajada?" es "¿existe ese fichero?".
    expect(restored?.path).toBe('img-0000-4000-8000-000000000001.jpg');
  });

  it('pushes local rows to the server stamped with the account uuid', async () => {
    const { db } = makeTestDb();
    const server = new FakeServer();
    await createRestaurant(db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });

    await engineFor(db, server).push();

    expect(server.count('restaurants')).toBe(1);
    const [record] = server.since('restaurants', null);
    expect(record?.name).toBe('Guadalupe');
    expect(record?.user_id).toBe(ACCOUNT);
    expect(record?.deleted).toBe(false);
  });

  it('marks change_log entries synced after a push', async () => {
    const { db } = makeTestDb();
    const server = new FakeServer();
    await createRestaurant(db, {
      name: 'Guadalupe',
      comments: null,
      rating: null,
      latitude: null,
      longitude: null,
    });

    await engineFor(db, server).push();

    const unsynced = await db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));
    expect(unsynced).toHaveLength(0);
  });

  it('bootstraps a fresh device: pull recreates rows with local ids', async () => {
    const server = new FakeServer();

    // Device A creates data and pushes.
    const a = makeTestDb();
    const restaurantId = await createRestaurant(a.db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });
    await createDish(a.db, {
      name: 'Chihuahua',
      price: 1200,
      rating: 5,
      comments: null,
      restaurantId,
    });
    await engineFor(a.db, server).push();

    // Device B (empty) pulls.
    const b = makeTestDb();
    await engineFor(b.db, server).pull();

    const restaurant = await restaurantByName(b.db, 'Guadalupe');
    expect(restaurant).toBeDefined();

    const dishes = await b.db.select().from(schema.dishes);
    expect(dishes).toHaveLength(1);
    // The FK was translated from uuid back to device B's own local id.
    expect(dishes[0]?.restaurantId).toBe(restaurant!.id);
    expect(dishes[0]?.name).toBe('Chihuahua');
  });

  it('propagates a soft-delete to the other device', async () => {
    const server = new FakeServer();
    const a = makeTestDb();
    const b = makeTestDb();

    const id = await createRestaurant(a.db, {
      name: 'Guadalupe',
      comments: null,
      rating: null,
      latitude: null,
      longitude: null,
    });
    await engineFor(a.db, server).push();
    await engineFor(b.db, server).pull();
    expect((await restaurantByName(b.db, 'Guadalupe'))?.deleted).toBe(false);

    // A deletes and syncs; B pulls.
    await softDeleteRestaurant(a.db, id);
    await engineFor(a.db, server).push();
    await engineFor(b.db, server).pull();

    expect((await restaurantByName(b.db, 'Guadalupe'))?.deleted).toBe(true);
  });

  it('resolves conflicts by last-write-wins on updated_at', async () => {
    const server = new FakeServer();
    const a = makeTestDb();
    const b = makeTestDb();

    const idA = await createRestaurant(a.db, {
      name: 'Guadalupe',
      comments: null,
      rating: 1,
      latitude: null,
      longitude: null,
    });
    await engineFor(a.db, server).push();
    await engineFor(b.db, server).pull();
    const idB = (await restaurantByName(b.db, 'Guadalupe'))!.id;

    // B edits earlier, A edits later (both after creation). A must win
    // regardless of push order. Far-future timestamps keep them after `now`.
    await editAt(b.db, idB, 2, '2099-01-01T10:00:00.000Z');
    await editAt(a.db, idA, 3, '2099-01-01T12:00:00.000Z');

    // B (older) pushes first, then A (newer).
    await new SyncEngine(b.db, server.transport(), ACCOUNT).push();
    await new SyncEngine(a.db, server.transport(), ACCOUNT).push();

    const [record] = server.since('restaurants', null);
    expect(record?.rating).toBe(3); // newer write wins on the server

    // A stale re-push from B does not clobber the server.
    await new SyncEngine(b.db, server.transport(), ACCOUNT).push();
    expect(server.since('restaurants', null)[0]?.rating).toBe(3);
  });

  it('is idempotent: repeated sync makes no further changes', async () => {
    const server = new FakeServer();
    const a = makeTestDb();
    const b = makeTestDb();

    await createRestaurant(a.db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });
    await engineFor(a.db, server).sync();
    await engineFor(b.db, server).sync();
    await engineFor(b.db, server).sync();

    const restaurants = await b.db.select().from(schema.restaurants);
    expect(restaurants).toHaveLength(1);
  });

  it('does not mark as synced a change enqueued during the push', async () => {
    // Regression: push used to blanket-update `synced = false` rows, which also
    // swallowed anything queued while it ran — losing that change forever.
    const { db } = makeTestDb();
    const server = new FakeServer();
    await createRestaurant(db, {
      name: 'Guadalupe',
      comments: null,
      rating: null,
      latitude: null,
      longitude: null,
    });

    // A transport that enqueues a new local change midway through the push,
    // simulating the user saving while a sync is in flight.
    let injected = false;
    const racyTransport = {
      push: async (table: string, records: RemoteRecord[]) => {
        server.upsert(table, records);
        if (!injected) {
          injected = true;
          await db.insert(schema.changeLog).values({
            tableName: 'restaurants',
            rowId: 999,
            rowUuid: 'queued-mid-push',
            operation: 'update',
          });
        }
      },
      pull: async (table: string, cursor: number | null, limit: number) =>
        server.since(table, cursor, limit),
      counts: async () => ({}),
      replaceLinks: async () => {},
      pullLinks: async () => [],
    };

    await new SyncEngine(db, racyTransport, ACCOUNT).push();

    const stillPending = await db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));
    expect(stillPending.map((c) => c.rowUuid)).toEqual(['queued-mid-push']);
  });

  it('does not let one row it may not own stop the whole push', async () => {
    // RLS is not a filter: it says what you may *read*, and you may read a
    // friend's shared visit. An unfiltered pull therefore wrote other people's
    // rows into the local diary, and the next push stamped them with this
    // account and upserted them onto their owner's — which the owner policy
    // rejects, killing the entire push. The transport now filters by owner, so
    // this cannot recur; a device already holding such a row still has to be
    // able to sync everything else.
    const server = new FakeServer();
    const { db } = makeTestDb();

    const mine = await createRestaurant(db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });
    const theirs = await createRestaurant(db, {
      name: 'De otra persona',
      comments: null,
      rating: null,
      latitude: null,
      longitude: null,
    });

    const [foreign] = await db
      .select({ uuid: schema.restaurants.uuid })
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, theirs));

    const guarded = {
      ...server.transport(),
      push: async (table: string, records: RemoteRecord[]) => {
        if (records.some((r) => r.uuid === foreign!.uuid)) {
          throw new Error(
            'push restaurants: new row violates row-level security policy ' +
              '(USING expression) for table "restaurants"',
          );
        }
        server.upsert(table, records);
      },
    };

    await new SyncEngine(db, guarded, ACCOUNT).push();

    // The row that was ours got through.
    expect(server.count('restaurants')).toBe(1);
    expect(server.since('restaurants', null)[0]?.['name']).toBe('Guadalupe');

    // And nothing is left blocking the outbox for next time.
    const stuck = await db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));
    expect(stuck).toHaveLength(0);

    // The row itself is still there: recovering from a sync bug by deleting
    // rows is how a backup becomes a smaller backup.
    const survivors = await db.select().from(schema.restaurants);
    expect(survivors).toHaveLength(2);
    expect(mine).toBeDefined();
  });

  it('still fails loudly on an error that is not about ownership', async () => {
    const server = new FakeServer();
    const { db } = makeTestDb();
    await createRestaurant(db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });

    const broken = {
      ...server.transport(),
      push: async () => {
        throw new Error('push restaurants: null value in column "name" violates not-null');
      },
    };

    await expect(new SyncEngine(db, broken, ACCOUNT).push()).rejects.toThrow('not-null');
  });

  it('does not push back a row it has just pulled', async () => {
    // linkLocalData enqueues every row with no change_log entry, which is how a
    // first login uploads a diary older than the account. A pulled row looks
    // exactly like one, so without a marker the device echoes the server's own
    // rows back at it — harmless for scalars (last-write-wins keeps the newer)
    // and destructive for links, where this device's stale set would overwrite
    // a change another device had just made.
    const server = new FakeServer();
    const source = makeTestDb();
    await createRestaurant(source.db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });
    await engineFor(source.db, server).sync();

    const mirror = makeTestDb();
    await engineFor(mirror.db, server).pull();

    const outbox = await mirror.db.select().from(schema.changeLog);
    expect(outbox).not.toHaveLength(0);
    expect(outbox.every((entry) => entry.synced)).toBe(true);

    // And a subsequent push finds nothing to send.
    await engineFor(mirror.db, server).push();
    const stillUnsynced = await mirror.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));
    expect(stillUnsynced).toHaveLength(0);
  });

  it('self-heals a row whose change_log entry was never written', async () => {
    // Repositories write the row and its change_log entry as separate
    // statements (no cross-driver transactions). If the app dies in between,
    // push must still pick the row up rather than leave it unsynced forever.
    const { db } = makeTestDb();
    const server = new FakeServer();
    await db.insert(schema.restaurants).values({
      name: 'Huérfano',
      uuid: 'orphan-uuid',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(await db.select().from(schema.changeLog)).toHaveLength(0);

    await engineFor(db, server).push();

    expect(server.count('restaurants')).toBe(1);
    expect(server.since('restaurants', null)[0]?.name).toBe('Huérfano');
  });

  it('advances the cursor so a second pull is a no-op', async () => {
    const server = new FakeServer();
    const a = makeTestDb();
    const b = makeTestDb();
    await createRestaurant(a.db, {
      name: 'Guadalupe',
      comments: null,
      rating: 5,
      latitude: null,
      longitude: null,
    });
    await engineFor(a.db, server).push();

    await engineFor(b.db, server).pull();
    const cursorRow = await b.db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, 'sync_cursor_restaurants'));
    expect(cursorRow[0]?.value).toBeTruthy();

    // Pulling again with the advanced cursor returns nothing new.
    await engineFor(b.db, server).pull();
    expect(await b.db.select().from(schema.restaurants)).toHaveLength(1);
  });
});
