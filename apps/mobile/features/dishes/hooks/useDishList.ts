import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import { scopedTo, useCurrentAccount } from '@/services/db/account-scope';
import * as schema from '@/services/db/schema';

import { mapDishListRows } from '../mappers/mapDishListRows';

export const useDishList = (includeDeleted: boolean = false) => {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);
  const account = useCurrentAccount();

  const query = drizzleDb
    .select({
      dishVisibility: schema.dishes.visibility,
      dishId: schema.dishes.id,
      dishName: schema.dishes.name,
      dishComments: schema.dishes.comments,
      dishRating: schema.dishes.rating,
      dishDeleted: schema.dishes.deleted,
      tagId: schema.tags.id,
      tagName: schema.tags.name,
      tagColor: schema.tags.color,
      imageId: schema.images.id,
      imagePath: schema.images.path,
      imageRemoteKey: schema.images.remoteKey,
    })
    .from(schema.dishes);

  query.where(
    scopedTo(
      schema.dishes.accountUuid,
      account,
      includeDeleted ? undefined : eq(schema.dishes.deleted, false),
    ),
  );

  query
    .leftJoin(schema.dishTags, eq(schema.dishes.id, schema.dishTags.dishId))
    .leftJoin(schema.tags, eq(schema.dishTags.tagId, schema.tags.id))
    .leftJoin(schema.images, eq(schema.dishes.id, schema.images.dishId));

  const { data: rawData } = useLiveTablesQuery(
    query,
    [schema.dishes, schema.dishTags, schema.tags, schema.images],
    [includeDeleted, account],
  );

  return useMemo(() => mapDishListRows(rawData ?? []), [rawData]);
};
