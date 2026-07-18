import { eq } from 'drizzle-orm';

import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';

import { createVisit, updateVisit, softDeleteVisit } from './visitRepository';

import type { AppDatabase } from '@/services/db/types';

async function seedRestaurant(db: AppDatabase) {
  const [r] = await db
    .insert(schema.restaurants)
    .values({ name: 'Guadalupe', uuid: 'r-uuid', createdAt: 't', updatedAt: 't' })
    .returning({ id: schema.restaurants.id });
  return r!.id;
}

describe('visitRepository — people tagging', () => {
  it('tags people on a visit, creating person rows on demand', async () => {
    const { db } = makeTestDb();
    const restaurantId = await seedRestaurant(db);

    const visitId = await createVisit(
      db,
      { visitedAt: '2026-03-01', comments: null, restaurantId },
      [],
      ['Irene', 'Caro'],
    );

    const people = await db.select().from(schema.people);
    expect(people.map((p) => p.name).sort()).toEqual(['Caro', 'Irene']);

    const participants = await db
      .select()
      .from(schema.visitParticipants)
      .where(eq(schema.visitParticipants.visitId, visitId));
    expect(participants).toHaveLength(2);
    expect(participants.every((p) => p.tagStatus === 'local')).toBe(true);
  });

  it('reuses an existing person when the same name is tagged again', async () => {
    const { db } = makeTestDb();
    const restaurantId = await seedRestaurant(db);

    await createVisit(db, { visitedAt: '2026-03-01', comments: null, restaurantId }, [], ['Caro']);
    await createVisit(db, { visitedAt: '2026-03-08', comments: null, restaurantId }, [], ['Caro']);

    const people = await db.select().from(schema.people).where(eq(schema.people.name, 'Caro'));
    expect(people).toHaveLength(1);
  });

  it('replaces participants on update', async () => {
    const { db } = makeTestDb();
    const restaurantId = await seedRestaurant(db);
    const visitId = await createVisit(
      db,
      { visitedAt: '2026-03-01', comments: null, restaurantId },
      [],
      ['Irene', 'Caro'],
    );

    await updateVisit(
      db,
      visitId,
      { visitedAt: '2026-03-01', comments: null, restaurantId },
      [],
      ['Nacho'],
    );

    const participants = await db
      .select({ personId: schema.visitParticipants.personId })
      .from(schema.visitParticipants)
      .where(eq(schema.visitParticipants.visitId, visitId));
    expect(participants).toHaveLength(1);

    const [person] = await db
      .select({ name: schema.people.name })
      .from(schema.people)
      .where(eq(schema.people.id, participants[0]!.personId));
    expect(person?.name).toBe('Nacho');
  });

  it('ignores blank names and deduplicates', async () => {
    const { db } = makeTestDb();
    const restaurantId = await seedRestaurant(db);
    const visitId = await createVisit(
      db,
      { visitedAt: '2026-03-01', comments: null, restaurantId },
      [],
      ['Caro', '  ', 'Caro'],
    );

    const participants = await db
      .select()
      .from(schema.visitParticipants)
      .where(eq(schema.visitParticipants.visitId, visitId));
    expect(participants).toHaveLength(1);
  });

  it('soft-delete keeps the visit and logs a delete', async () => {
    const { db } = makeTestDb();
    const restaurantId = await seedRestaurant(db);
    const visitId = await createVisit(
      db,
      { visitedAt: '2026-03-01', comments: null, restaurantId },
      [],
      [],
    );

    await softDeleteVisit(db, visitId);

    const [row] = await db.select().from(schema.visits).where(eq(schema.visits.id, visitId));
    expect(row?.deleted).toBe(true);
    const del = await db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.operation, 'delete'));
    expect(del).toHaveLength(1);
  });
});
