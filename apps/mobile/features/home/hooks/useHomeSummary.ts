import { count, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

export interface RecentVisit {
  id: number;
  visitedAt: string | null;
  comments: string | null;
  restaurantName: string | null;
  imagePath: string | null;
}

/**
 * The numbers and the short list the home dashboard shows.
 *
 * Counted in SQL rather than by loading the lists and taking `.length`: a real
 * diary has thousands of rows and the home screen has no use for any of them
 * beyond the most recent handful.
 */
export function useHomeSummary(recentLimit = 3) {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);

  const countsQuery = useMemo(
    () =>
      drizzleDb
        .select({
          restaurants: count(schema.restaurants.id),
        })
        .from(schema.restaurants)
        .where(eq(schema.restaurants.deleted, false)),
    [drizzleDb],
  );

  const dishCountQuery = useMemo(
    () =>
      drizzleDb
        .select({ dishes: count(schema.dishes.id) })
        .from(schema.dishes)
        .where(eq(schema.dishes.deleted, false)),
    [drizzleDb],
  );

  const visitCountQuery = useMemo(
    () =>
      drizzleDb
        .select({ visits: count(schema.visits.id) })
        .from(schema.visits)
        .where(eq(schema.visits.deleted, false)),
    [drizzleDb],
  );

  const recentQuery = useMemo(
    () =>
      drizzleDb
        .select({
          id: schema.visits.id,
          visitedAt: schema.visits.visitedAt,
          comments: schema.visits.comments,
          restaurantName: schema.restaurants.name,
          imagePath: schema.images.path,
        })
        .from(schema.visits)
        .leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
        .leftJoin(schema.images, eq(schema.visits.id, schema.images.visitId))
        .where(eq(schema.visits.deleted, false))
        .orderBy(desc(schema.visits.visitedAt), desc(schema.visits.id))
        // One row per image would repeat a visit; over-fetch, then de-duplicate.
        .limit(recentLimit * 6),
    [drizzleDb, recentLimit],
  );

  const { data: restaurantRows } = useLiveTablesQuery(countsQuery, ['restaurants']);
  const { data: dishRows } = useLiveTablesQuery(dishCountQuery, ['dishes']);
  const { data: visitRows } = useLiveTablesQuery(visitCountQuery, ['visits']);
  const { data: recentRows } = useLiveTablesQuery(recentQuery, ['visits', 'restaurants', 'images']);

  const recent = useMemo(() => {
    const seen = new Map<number, RecentVisit>();
    for (const row of recentRows ?? []) {
      const existing = seen.get(row.id);
      if (!existing) {
        seen.set(row.id, {
          id: row.id,
          visitedAt: row.visitedAt,
          comments: row.comments,
          restaurantName: row.restaurantName,
          imagePath: row.imagePath,
        });
      } else if (!existing.imagePath && row.imagePath) {
        existing.imagePath = row.imagePath;
      }
      if (seen.size >= recentLimit && seen.get(row.id)?.imagePath) break;
    }
    return [...seen.values()].slice(0, recentLimit);
  }, [recentRows, recentLimit]);

  return {
    restaurants: restaurantRows?.[0]?.restaurants ?? 0,
    dishes: dishRows?.[0]?.dishes ?? 0,
    visits: visitRows?.[0]?.visits ?? 0,
    recent,
  };
}
