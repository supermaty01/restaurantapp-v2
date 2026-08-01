import { eq } from 'drizzle-orm';

import { createDish } from '@/features/dishes/repositories/dishRepository';
import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { createVisit, updateVisit } from '@/features/visits/repositories/visitRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine } from '@/services/sync/engine';
import { LINK_TABLES } from '@/services/sync/tables';

import { FakeServer } from './fake-transport';

const place = (name: string) => ({
  name,
  comments: null,
  rating: null,
  latitude: null,
  longitude: null,
});
const plate = (name: string, restaurantId: number) => ({
  name,
  price: null,
  currency: null,
  rating: null,
  comments: null,
  restaurantId,
});

/**
 * Junction rows have to survive the round trip.
 *
 * They were in the mirror from the first migration and nothing sent them, so a
 * synced diary arrived with its tags, its dishes-per-visit and its tagged people
 * silently stripped. The app never showed the loss because it reads all three
 * from the device, where they were still intact — the hole only opened on a
 * second device, or after a reinstall.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

function engineFor(db: AppDatabase, server: FakeServer) {
  return new SyncEngine(db, server.transport(), ACCOUNT);
}

/** A restaurant with one tag, a dish, and a visit linking to that dish. */
async function seedDiary(db: AppDatabase) {
  const [tag] = await db
    .insert(schema.tags)
    .values({
      name: 'ramen',
      color: '#e11d48',
      uuid: crypto.randomUUID(),
      createdAt: 'x',
      updatedAt: 'x',
    })
    .returning({ id: schema.tags.id });

  const restaurantId = await createRestaurant(db, place('Ichiran'), [tag!.id]);
  const dishId = await createDish(db, plate('Tonkotsu', restaurantId));
  const visitId = await createVisit(
    db,
    { restaurantId, visitedAt: '2026-01-05', comments: null },
    [dishId],
    [{ name: 'Irene' }],
  );

  return { tagId: tag!.id, restaurantId, dishId, visitId };
}

describe('junction sync', () => {
  it('every junction in the local schema is registered', () => {
    // The registry is hand-written, and a junction missing from it fails the
    // way the original bug did: silently, and only for the second device.
    const registered = new Set(LINK_TABLES.map((cfg) => cfg.name));
    for (const junction of ['restaurant_tag', 'dish_tag', 'dish_visit', 'visit_participant']) {
      expect([...registered]).toContain(junction);
    }
  });

  it('carries tags, dishes-per-visit and tagged people to a second device', async () => {
    const server = new FakeServer();
    const first = makeTestDb();
    await seedDiary(first.db);
    await engineFor(first.db, server).sync();

    expect(server.linkCount('restaurant_tag')).toBe(1);
    expect(server.linkCount('dish_visit')).toBe(1);
    expect(server.linkCount('visit_participant')).toBe(1);

    const second = makeTestDb();
    await engineFor(second.db, server).sync();

    const links = await second.db.select().from(schema.dishVisits);
    expect(links).toHaveLength(1);

    const participants = await second.db
      .select({ name: schema.people.name })
      .from(schema.visitParticipants)
      .innerJoin(schema.people, eq(schema.visitParticipants.personId, schema.people.id));
    expect(participants.map((p) => p.name)).toEqual(['Irene']);

    const restaurantTags = await second.db.select().from(schema.restaurantTags);
    expect(restaurantTags).toHaveLength(1);
  });

  it('propagates a removed link, which has no tombstone to announce it', async () => {
    const server = new FakeServer();
    const first = makeTestDb();
    const { restaurantId, visitId } = await seedDiary(first.db);
    await engineFor(first.db, server).sync();

    const second = makeTestDb();
    await engineFor(second.db, server).sync();
    expect(await second.db.select().from(schema.dishVisits)).toHaveLength(1);

    // Untagging everyone and unlinking the dish: the visit row itself barely
    // changes, and the only evidence is the absence of the links.
    await updateVisit(
      first.db,
      visitId,
      { restaurantId, visitedAt: '2026-01-05', comments: null },
      [],
      [],
    );
    await engineFor(first.db, server).sync();
    expect(server.linkCount('dish_visit')).toBe(0);

    await engineFor(second.db, server).sync();
    expect(await second.db.select().from(schema.dishVisits)).toHaveLength(0);
    expect(await second.db.select().from(schema.visitParticipants)).toHaveLength(0);
  });

  it('leaves untouched parents alone', async () => {
    // A pull that rewrote every junction would undo links the device made
    // while offline. Only parents that came back in this pass are replaced.
    const server = new FakeServer();
    const first = makeTestDb();
    await seedDiary(first.db);
    await engineFor(first.db, server).sync();

    const second = makeTestDb();
    await engineFor(second.db, server).sync();

    // A local-only visit on the second device, never pushed.
    const [restaurant] = await second.db.select().from(schema.restaurants).limit(1);
    const soloDish = await createDish(second.db, plate('Gyoza', restaurant!.id));
    const soloVisit = await createVisit(
      second.db,
      { restaurantId: restaurant!.id, visitedAt: '2026-02-01', comments: null },
      [soloDish],
    );

    await engineFor(second.db, server).pull();

    const survived = await second.db
      .select()
      .from(schema.dishVisits)
      .where(eq(schema.dishVisits.visitId, soloVisit));
    expect(survived).toHaveLength(1);
  });
});
