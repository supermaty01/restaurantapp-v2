import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

/**
 * Who was there.
 *
 * A tag is a name, and *optionally* a pointer to a real account. Both halves
 * matter: most of the people you eat with do not use this app, and "Irene" has
 * to be a perfectly good answer. When the person does have an account, the tag
 * carries their uuid so the visit can reach them.
 *
 * The handle is copied onto the row rather than looked up. A tag has to render
 * offline and years later, and a stored `@caro1234` that has since been renamed
 * is a smaller problem than a chip that cannot draw itself.
 */
export interface PersonTag {
  /** What the chip shows. */
  name: string;
  /** The tagged account, when the tag points at one. */
  accountUuid?: string | null;
  username?: string | null;
}

export interface PersonDTO extends PersonTag {
  id: number;
}

function normalise(name: string): string {
  return name.trim();
}

/**
 * The person row for a tag, created if this is the first time.
 *
 * Identity is the account when there is one, and the name otherwise. That
 * asymmetry is deliberate: two friends can both be called Ana, but one account
 * is one person — whereas re-typing "Irene" clearly means the same Irene, and
 * making the app accumulate duplicates of her would be worse than the rare case
 * of two unrelated Irenes sharing a row.
 */
export async function findOrCreatePerson(db: AppDatabase, tag: PersonTag): Promise<number> {
  const name = normalise(tag.name);
  const accountUuid = tag.accountUuid ?? null;

  const [existing] = accountUuid
    ? await db
        .select({ id: schema.people.id })
        .from(schema.people)
        .where(
          and(eq(schema.people.linkedAccountUuid, accountUuid), eq(schema.people.deleted, false)),
        )
        .limit(1)
    : await db
        .select({ id: schema.people.id })
        .from(schema.people)
        .where(
          and(
            eq(schema.people.name, name),
            eq(schema.people.deleted, false),
            sql`${schema.people.linkedAccountUuid} is null`,
          ),
        )
        .limit(1);

  if (existing) {
    // A person who has since joined, or changed their handle: keep the row and
    // let the newer information win. Re-tagging is how the app finds out.
    if (accountUuid) {
      const [row] = await db
        .update(schema.people)
        .set({
          name,
          linkedAccountUuid: accountUuid,
          username: tag.username ?? null,
          ...touchedAt(),
        })
        .where(eq(schema.people.id, existing.id))
        .returning({ uuid: schema.people.uuid });
      if (row) await recordChange(db, 'people', existing.id, row.uuid, 'update');
    }
    return existing.id;
  }

  const [row] = await db
    .insert(schema.people)
    .values({
      name,
      linkedAccountUuid: accountUuid,
      username: tag.username ?? null,
      ...newSyncValues(),
    })
    .returning({ id: schema.people.id, uuid: schema.people.uuid });

  if (!row) throw new Error('No se pudo crear la persona');

  await recordChange(db, 'people', row.id, row.uuid, 'insert');
  return row.id;
}

/**
 * People already tagged before, most recent first, for the suggestion list.
 *
 * Includes linked accounts: someone you tag often is worth suggesting whether
 * or not they use the app, and the friend picker is a separate door for finding
 * people you have never tagged.
 */
export async function listKnownPeople(db: AppDatabase, limit = 30): Promise<PersonDTO[]> {
  const rows = await db
    .select({
      id: schema.people.id,
      name: schema.people.name,
      accountUuid: schema.people.linkedAccountUuid,
      username: schema.people.username,
    })
    .from(schema.people)
    .where(eq(schema.people.deleted, false))
    .orderBy(desc(schema.people.updatedAt))
    .limit(limit);

  return rows;
}

/** People not linked to an account, for the tag autocomplete. */
export async function listLocalPeople(db: AppDatabase): Promise<PersonDTO[]> {
  return db
    .select({
      id: schema.people.id,
      name: schema.people.name,
      accountUuid: schema.people.linkedAccountUuid,
      username: schema.people.username,
    })
    .from(schema.people)
    .where(and(eq(schema.people.deleted, false), sql`${schema.people.linkedAccountUuid} is null`))
    .orderBy(schema.people.name);
}

/** The accounts this diary has ever tagged, for reconciling handles on sync. */
export async function listLinkedAccounts(db: AppDatabase): Promise<PersonDTO[]> {
  return db
    .select({
      id: schema.people.id,
      name: schema.people.name,
      accountUuid: schema.people.linkedAccountUuid,
      username: schema.people.username,
    })
    .from(schema.people)
    .where(and(eq(schema.people.deleted, false), isNotNull(schema.people.linkedAccountUuid)))
    .orderBy(schema.people.name);
}
