import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { createTag } from '@/features/tags/repositories/tagRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import { linkLocalData } from '@/services/sync/linkLocalData';

describe('linkLocalData', () => {
  it('queues every local row that has no change_log entry yet', async () => {
    const { db } = makeTestDb();
    // Insert rows directly (no change_log), simulating anonymous pre-login data.
    await db
      .insert(schema.restaurants)
      .values({ name: 'Guadalupe', uuid: 'r1', createdAt: 't', updatedAt: 't' });
    await db
      .insert(schema.tags)
      .values({ name: 'Fav', color: '#f00', uuid: 't1', createdAt: 't', updatedAt: 't' });

    const queued = await linkLocalData(db);

    expect(queued).toBe(2);
    const log = await db.select().from(schema.changeLog);
    expect(log).toHaveLength(2);
    expect(log.every((c) => c.operation === 'insert')).toBe(true);
  });

  it('does not double-queue rows already in the change_log', async () => {
    const { db } = makeTestDb();
    // createRestaurant already enqueues an insert.
    await createRestaurant(db, {
      name: 'Guadalupe',
      comments: null,
      rating: null,
      latitude: null,
      longitude: null,
    });
    await createTag(db, { name: 'Fav', color: '#f00' });

    const queued = await linkLocalData(db);

    expect(queued).toBe(0); // both already queued by their repositories
    expect(await db.select().from(schema.changeLog)).toHaveLength(2);
  });
});
