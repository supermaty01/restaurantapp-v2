import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';

import type { SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * Structured queries over the local diary — the exact, aggregable half of the
 * assistant's hybrid retrieval (docs/07). Answers "how many carbonaras did I eat
 * in Rome?" and "when did I last eat with Caro?" with SQL, not an LLM guess: the
 * model only picks and parameterises these; SQLite does the counting.
 *
 * Text matching is case-insensitive substring (SQLite LIKE); fuzzy resolution
 * ("that spicy ramen") is the semantic tool's job, feeding ids in here.
 */

/**
 * Case-insensitive "contains" over a text column.
 *
 * Wildcards in user input are escaped and the ESCAPE clause is emitted
 * explicitly: SQLite ignores the escape character otherwise, so a dish named
 * "Menú 100%" would be unfindable and a lone "%" would match everything.
 * drizzle's `like()` can't emit ESCAPE, hence the raw fragment.
 */
function contains(col: SQLiteColumn, value: string): SQL {
  const escaped = value.replace(/[%_\\]/g, (m) => `\\${m}`);
  return sql`${col} LIKE ${`%${escaped}%`} ESCAPE '\\'`;
}

export interface DishCountFilters {
  /** Substring of the dish name, e.g. "carbonara". */
  dishQuery?: string | undefined;
  /** Substring of the restaurant name, e.g. "roma". */
  restaurantQuery?: string | undefined;
  /** Inclusive ISO date bounds on the visit date. */
  from?: string | undefined;
  to?: string | undefined;
}

/**
 * How many times a matching dish was eaten (one per visit×dish pairing).
 * "¿Cuántas carbonaras comí en Roma este año?" → dishQuery + restaurantQuery + from/to.
 */
export async function countDishOccurrences(
  db: AppDatabase,
  filters: DishCountFilters,
): Promise<number> {
  const conditions = [eq(schema.visits.deleted, false), eq(schema.dishes.deleted, false)];
  if (filters.dishQuery) conditions.push(contains(schema.dishes.name, filters.dishQuery));
  if (filters.restaurantQuery) {
    conditions.push(contains(schema.restaurants.name, filters.restaurantQuery));
  }
  if (filters.from) conditions.push(gte(schema.visits.visitedAt, filters.from));
  if (filters.to) conditions.push(lte(schema.visits.visitedAt, filters.to));

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.dishVisits)
    .innerJoin(schema.visits, eq(schema.dishVisits.visitId, schema.visits.id))
    .innerJoin(schema.dishes, eq(schema.dishVisits.dishId, schema.dishes.id))
    .leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
    .where(and(...conditions));

  return Number(rows[0]?.count ?? 0);
}

export interface VisitSummary {
  visitId: number;
  visitedAt: string | null;
  restaurantName: string | null;
}

/**
 * The most recent visit tagged with a person.
 * "¿Cuándo fue la última vez que comí con Caro?" → personQuery = "Caro".
 */
export async function lastVisitWithPerson(
  db: AppDatabase,
  personQuery: string,
): Promise<VisitSummary | null> {
  const rows = await db
    .select({
      visitId: schema.visits.id,
      visitedAt: schema.visits.visitedAt,
      restaurantName: schema.restaurants.name,
    })
    .from(schema.visitParticipants)
    .innerJoin(schema.people, eq(schema.visitParticipants.personId, schema.people.id))
    .innerJoin(schema.visits, eq(schema.visitParticipants.visitId, schema.visits.id))
    .leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
    .where(and(contains(schema.people.name, personQuery), eq(schema.visits.deleted, false)))
    .orderBy(desc(schema.visits.visitedAt))
    .limit(1);

  return rows[0] ?? null;
}

/** How many visits included a given person (in an optional date range). */
export async function countVisitsWithPerson(
  db: AppDatabase,
  personQuery: string,
  range: { from?: string | undefined; to?: string | undefined } = {},
): Promise<number> {
  const conditions = [contains(schema.people.name, personQuery), eq(schema.visits.deleted, false)];
  if (range.from) conditions.push(gte(schema.visits.visitedAt, range.from));
  if (range.to) conditions.push(lte(schema.visits.visitedAt, range.to));

  const rows = await db
    .select({ count: sql<number>`count(distinct ${schema.visits.id})` })
    .from(schema.visitParticipants)
    .innerJoin(schema.people, eq(schema.visitParticipants.personId, schema.people.id))
    .innerJoin(schema.visits, eq(schema.visitParticipants.visitId, schema.visits.id))
    .where(and(...conditions));

  return Number(rows[0]?.count ?? 0);
}

export interface EntityMatch {
  id: number;
  name: string;
}

/** Resolve a fuzzy name to candidate entities so the agent can disambiguate. */
export async function searchRestaurants(db: AppDatabase, query: string): Promise<EntityMatch[]> {
  return db
    .select({ id: schema.restaurants.id, name: schema.restaurants.name })
    .from(schema.restaurants)
    .where(and(contains(schema.restaurants.name, query), eq(schema.restaurants.deleted, false)))
    .limit(10);
}

export async function searchDishes(db: AppDatabase, query: string): Promise<EntityMatch[]> {
  return db
    .select({ id: schema.dishes.id, name: schema.dishes.name })
    .from(schema.dishes)
    .where(and(contains(schema.dishes.name, query), eq(schema.dishes.deleted, false)))
    .limit(10);
}

export async function searchPeople(db: AppDatabase, query: string): Promise<EntityMatch[]> {
  return db
    .select({ id: schema.people.id, name: schema.people.name })
    .from(schema.people)
    .where(and(contains(schema.people.name, query), eq(schema.people.deleted, false)))
    .limit(10);
}
