import { eq } from 'drizzle-orm';

import { findOrCreatePerson } from '@/features/people/repositories/peopleRepository';
import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

export interface VisitWriteInput {
  visitedAt: string;
  comments: string | null;
  restaurantId: number;
}

/** Names of the people tagged on a visit (for pre-filling the edit form). */
export async function getVisitParticipantNames(
  db: AppDatabase,
  visitId: number,
): Promise<string[]> {
  const rows = await db
    .select({ name: schema.people.name })
    .from(schema.visitParticipants)
    .innerJoin(schema.people, eq(schema.visitParticipants.personId, schema.people.id))
    .where(eq(schema.visitParticipants.visitId, visitId));
  return rows.map((r) => r.name);
}

export async function createVisit(
  db: AppDatabase,
  input: VisitWriteInput,
  dishIds: number[] = [],
  participantNames: string[] = [],
): Promise<number> {
  const [row] = await db
    .insert(schema.visits)
    .values({ ...input, ...newSyncValues() })
    .returning({ id: schema.visits.id, uuid: schema.visits.uuid });

  if (!row) throw new Error('No se pudo crear la visita');

  await recordChange(db, 'visits', row.id, row.uuid, 'insert');
  await setVisitDishes(db, row.id, dishIds);
  await setVisitParticipants(db, row.id, participantNames);
  return row.id;
}

export async function updateVisit(
  db: AppDatabase,
  id: number,
  input: VisitWriteInput,
  dishIds: number[] = [],
  participantNames: string[] = [],
): Promise<void> {
  const [row] = await db
    .update(schema.visits)
    .set({ ...input, ...touchedAt() })
    .where(eq(schema.visits.id, id))
    .returning({ uuid: schema.visits.uuid });

  if (!row) throw new Error('Visita no encontrada');

  await recordChange(db, 'visits', id, row.uuid, 'update');
  await setVisitDishes(db, id, dishIds);
  await setVisitParticipants(db, id, participantNames);
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
 * Tags people on a visit. Names are resolved to person rows (created on demand);
 * the participation starts as 'local' — the pending/accepted social flow
 * (docs/06) lands with accounts in phase 5.
 */
async function setVisitParticipants(db: AppDatabase, visitId: number, names: string[]) {
  await db.delete(schema.visitParticipants).where(eq(schema.visitParticipants.visitId, visitId));

  const seen = new Set<number>();
  for (const name of names) {
    if (!name.trim()) continue;
    const personId = await findOrCreatePerson(db, name);
    if (seen.has(personId)) continue;
    seen.add(personId);
    await db.insert(schema.visitParticipants).values({ visitId, personId, tagStatus: 'local' });
  }
}
