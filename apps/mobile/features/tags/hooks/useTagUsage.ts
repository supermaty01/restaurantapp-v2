import { count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import { scopedTo, useCurrentAccount } from '@/services/db/account-scope';
import * as schema from '@/services/db/schema';

export interface TagUsage {
  tagId: number;
  restaurants: number;
  dishes: number;
  total: number;
}

/**
 * How many things each tag is actually on.
 *
 * The tag screen was a list of names and colours with nothing to act on, which
 * is why it felt pointless: you cannot decide whether to rename or delete a tag
 * without knowing what it labels. This is the missing context — and it also
 * gives the list a meaningful order, since alphabetical is useless once you
 * have thirty tags and use six.
 */
export function useTagUsage(): Map<number, TagUsage> {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);
  const account = useCurrentAccount();

  const restaurantCounts = useMemo(
    () =>
      drizzleDb
        .select({ tagId: schema.restaurantTags.tagId, total: count() })
        .from(schema.restaurantTags)
        .innerJoin(
          schema.restaurants,
          eq(schema.restaurants.id, schema.restaurantTags.restaurantId),
        )
        .where(
          scopedTo(schema.restaurants.accountUuid, account, eq(schema.restaurants.deleted, false)),
        )
        .groupBy(schema.restaurantTags.tagId),
    [drizzleDb, account],
  );

  const dishCounts = useMemo(
    () =>
      drizzleDb
        .select({ tagId: schema.dishTags.tagId, total: count() })
        .from(schema.dishTags)
        .innerJoin(schema.dishes, eq(schema.dishes.id, schema.dishTags.dishId))
        .where(scopedTo(schema.dishes.accountUuid, account, eq(schema.dishes.deleted, false)))
        .groupBy(schema.dishTags.tagId),
    [drizzleDb, account],
  );

  const { data: restaurantRows } = useLiveTablesQuery(
    restaurantCounts,
    [schema.restaurantTags, schema.restaurants],
    [account],
  );
  const { data: dishRows } = useLiveTablesQuery(
    dishCounts,
    [schema.dishTags, schema.dishes],
    [account],
  );

  return useMemo(() => {
    const usage = new Map<number, TagUsage>();

    const bump = (tagId: number, field: 'restaurants' | 'dishes', total: number) => {
      const current = usage.get(tagId) ?? { tagId, restaurants: 0, dishes: 0, total: 0 };
      current[field] += total;
      current.total += total;
      usage.set(tagId, current);
    };

    // tagId is nullable in the junction schema; a null one belongs to no tag.
    for (const row of restaurantRows ?? []) {
      if (row.tagId !== null) bump(row.tagId, 'restaurants', row.total);
    }
    for (const row of dishRows ?? []) {
      if (row.tagId !== null) bump(row.tagId, 'dishes', row.total);
    }

    return usage;
  }, [restaurantRows, dishRows]);
}
