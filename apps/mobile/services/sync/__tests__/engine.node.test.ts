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
