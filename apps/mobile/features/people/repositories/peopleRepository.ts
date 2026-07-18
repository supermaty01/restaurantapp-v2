import { and, eq, isNull } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

export interface PersonDTO {
  id: number;
  name: string;
}

/**
 * People a visit can be tagged with (docs/06). In local mode a person is just a
 * name; if they later link to a real account the row gains linkedUserId. Reused
 * by name so tagging "Caro" twice points at the same person.
 */
export async function findOrCreatePerson(db: AppDatabase, name: string): Promise<number> {
  const trimmed = name.trim();

  const [existing] = await db
    .select({ id: schema.people.id })
    .from(schema.people)
    .where(and(eq(schema.people.name, trimmed), eq(schema.people.deleted, false)))
    .limit(1);

  if (existing) return existing.id;

  const [row] = await db
    .insert(schema.people)
    .values({ name: trimmed, ...newSyncValues() })
    .returning({ id: schema.people.id, uuid: schema.people.uuid });

  if (!row) throw new Error('No se pudo crear la persona');

  await recordChange(db, 'people', row.id, row.uuid, 'insert');
  return row.id;
}

/** People not linked to an account, for the tag autocomplete. */
export async function listLocalPeople(db: AppDatabase): Promise<PersonDTO[]> {
  return db
    .select({ id: schema.people.id, name: schema.people.name })
    .from(schema.people)
    .where(and(eq(schema.people.deleted, false), isNull(schema.people.linkedUserId)))
    .orderBy(schema.people.name);
}
