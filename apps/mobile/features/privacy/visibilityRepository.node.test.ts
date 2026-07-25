import { eq } from 'drizzle-orm';

import { createVisit } from '@/features/visits/repositories/visitRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';

import { setVisibility } from './visibilityRepository';

async function seed(db: ReturnType<typeof makeTestDb>['db']) {
  const [restaurant] = await db
    .insert(schema.restaurants)
    .values({ name: 'Ichiran', uuid: crypto.randomUUID(), createdAt: 'x', updatedAt: 'x' })
    .returning({ id: schema.restaurants.id });
  return restaurant!.id;
}

describe('changing visibility after the fact', () => {
  it('writes the new value and queues it for sync', async () => {
    const { db } = makeTestDb();
    const restaurantId = await seed(db);
    const visitId = await createVisit(db, {
      visitedAt: '2026-05-01',
      comments: null,
      restaurantId,
    });

    await db.delete(schema.changeLog);
    await setVisibility(db, 'visit', visitId, 'friends');

    const [visit] = await db.select().from(schema.visits).where(eq(schema.visits.id, visitId));
    expect(visit!.visibility).toBe('friends');

    // The half that matters for *un*sharing: without an outbox entry the
    // mirror keeps serving the old value and you would think you had taken
    // something back when you had not.
    const queued = await db.select().from(schema.changeLog);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.tableName).toBe('visits');
    expect(queued[0]?.synced).toBe(false);
  });

  it('bumps updated_at, so last-write-wins does not discard it', async () => {
    const { db } = makeTestDb();
    const restaurantId = await seed(db);
    const visitId = await createVisit(db, {
      visitedAt: '2026-05-01',
      comments: null,
      restaurantId,
    });

    const [before] = await db.select().from(schema.visits).where(eq(schema.visits.id, visitId));
    await new Promise((resolve) => setTimeout(resolve, 2));
    await setVisibility(db, 'visit', visitId, 'public');

    const [after] = await db.select().from(schema.visits).where(eq(schema.visits.id, visitId));
    expect(after!.updatedAt > before!.updatedAt).toBe(true);
  });

  it('refuses an id that is not there instead of silently doing nothing', async () => {
    const { db } = makeTestDb();
    await expect(setVisibility(db, 'dish', 999, 'public')).rejects.toThrow();
  });
});
