import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import { scopedTo, useCurrentAccount } from '@/services/db/account-scope';
import * as schema from '@/services/db/schema';

import { mapRestaurantListRows } from '../mappers/mapRestaurantListRows';

export const useRestaurantList = (includeDeleted: boolean = false) => {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);
  const account = useCurrentAccount();

  const query = drizzleDb
    .select({
      restaurantVisibility: schema.restaurants.visibility,
      restaurantId: schema.restaurants.id,
      restaurantName: schema.restaurants.name,
      restaurantComments: schema.restaurants.comments,
      restaurantRating: schema.restaurants.rating,
      restaurantDeleted: schema.restaurants.deleted,
      tagId: schema.tags.id,
      tagName: schema.tags.name,
      tagColor: schema.tags.color,
      tagDeleted: schema.tags.deleted,
      imageId: schema.images.id,
      imagePath: schema.images.path,
      imageRemoteKey: schema.images.remoteKey,
    })
    .from(schema.restaurants);

  query.where(
    scopedTo(
      schema.restaurants.accountUuid,
      account,
      includeDeleted ? undefined : eq(schema.restaurants.deleted, false),
    ),
  );

  query
    .leftJoin(schema.restaurantTags, eq(schema.restaurants.id, schema.restaurantTags.restaurantId))
    .leftJoin(schema.tags, eq(schema.restaurantTags.tagId, schema.tags.id))
    .leftJoin(schema.images, eq(schema.restaurants.id, schema.images.restaurantId));

  const { data: rawData } = useLiveTablesQuery(
    query,
    [schema.restaurants, schema.restaurantTags, schema.tags, schema.images],
    [includeDeleted, account],
  );

  return useMemo(() => mapRestaurantListRows(rawData ?? []), [rawData]);
};
