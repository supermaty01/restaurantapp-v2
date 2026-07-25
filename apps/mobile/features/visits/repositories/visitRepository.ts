import { eq } from 'drizzle-orm';

import { findOrCreatePerson } from '@/features/people/repositories/peopleRepository';
import type { PersonTag } from '@/features/people/repositories/peopleRepository';
import type { Visibility } from '@/features/privacy/visibility';
import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

export interface VisitWriteInput {
  /** Who can see it. Omitted keeps whatever the row already had. */
  visibility?: Visibility;
  visitedAt: string;
  comments: string | null;
  restaurantId: number;
}

/** The people tagged on a visit, for the detail screen and the edit form. */
export async function getVisitParticipants(db: AppDatabase, visitId: number): Promise<PersonTag[]> {
  return db
    .select({
      name: schema.people.name,
      accountUuid: schema.people.linkedAccountUuid,
      username: schema.people.username,
    })
    .from(schema.visitParticipants)
    .innerJoin(schema.people, eq(schema.visitParticipants.personId, schema.people.id))
    .where(eq(schema.visitParticipants.visitId, visitId));
}

export async function createVisit(
  db: AppDatabase,
  input: VisitWriteInput,
  dishIds: number[] = [],
  participants: PersonTag[] = [],
): Promise<number> {
  const [row] = await db
    .insert(schema.visits)
    .values({ ...input, ...newSyncValues() })
    .returning({ id: schema.visits.id, uuid: schema.visits.uuid });

  if (!row) throw new Error('No se pudo crear la visita');

  await recordChange(db, 'visits', row.id, row.uuid, 'insert');
  await setVisitDishes(db, row.id, dishIds);
  await setVisitParticipants(db, row.id, participants);
  return row.id;
}

export async function updateVisit(
  db: AppDatabase,
  id: number,
  input: VisitWriteInput,
  dishIds: number[] = [],
  participants: PersonTag[] = [],
): Promise<void> {
  const [row] = await db
    .update(schema.visits)
    .set({ ...input, ...touchedAt() })
    .where(eq(schema.visits.id, id))
    .returning({ uuid: schema.visits.uuid });

  if (!row) throw new Error('Visita no encontrada');

  await recordChange(db, 'visits', id, row.uuid, 'update');
  await setVisitDishes(db, id, dishIds);
  await setVisitParticipants(db, id, participants);
}

export async function softDeleteVisit(db: AppDatabase, id: number): Promise<void> {
  const [row] = await db
    .update(schema.visits)
    .set({ deleted: true, ...touchedAt() })
    .where(eq(schema.visits.id, id))
    .returning({ uuid: schema.visits.uuid });

  if (row) await recordChange(db, 'visits', id, row.uuid, 'delete');
}

export async function hardDeleteVisit(db: AppDatabase, id: number): Promise<void> {
  const [row] = await db
    .select({ uuid: schema.visits.uuid })
    .from(schema.visits)
    .where(eq(schema.visits.id, id))
    .limit(1);

  await db.delete(schema.dishVisits).where(eq(schema.dishVisits.visitId, id));
  await db.delete(schema.visitParticipants).where(eq(schema.visitParticipants.visitId, id));
  await db.delete(schema.visits).where(eq(schema.visits.id, id));

  if (row) await recordChange(db, 'visits', id, row.uuid, 'delete');
}

async function setVisitDishes(db: AppDatabase, visitId: number, dishIds: number[]) {
  await db.delete(schema.dishVisits).where(eq(schema.dishVisits.visitId, visitId));
  for (const dishId of dishIds) {
    await db.insert(schema.dishVisits).values({ visitId, dishId });
  }
}

/**
 * Tags people on a visit, resolving each tag to a person row.
 *
 * `tagStatus` records whether the tag can travel: 'local' for someone without
 * an account — nothing to deliver it to — and 'pending' for a tagged friend,
 * who will see it in their own app once the visit syncs. Nobody is asked to
 * approve being tagged; the status exists so a tag that *can* reach a person is
 * distinguishable from one that is just a name written down.
 */
async function setVisitParticipants(db: AppDatabase, visitId: number, tags: PersonTag[]) {
  await db.delete(schema.visitParticipants).where(eq(schema.visitParticipants.visitId, visitId));

  const seen = new Set<number>();
  for (const tag of tags) {
    if (!tag.name.trim()) continue;
    const personId = await findOrCreatePerson(db, tag);
    if (seen.has(personId)) continue;
    seen.add(personId);
    await db.insert(schema.visitParticipants).values({
      visitId,
      personId,
      tagStatus: tag.accountUuid ? 'pending' : 'local',
    });
  }
}
