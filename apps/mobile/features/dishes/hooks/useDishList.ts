import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

import { mapDishListRows } from '../mappers/mapDishListRows';

export const useDishList = (includeDeleted: boolean = false) => {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);

  const query = drizzleDb
    .select({
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
    })
    .from(schema.dishes);

  if (!includeDeleted) {
    query.where(eq(schema.dishes.deleted, false));
  }

  query.leftJoin(schema.dishTags, eq(schema.dishes.id, schema.dishTags.dishId))
      .leftJoin(schema.tags, eq(schema.dishTags.tagId, schema.tags.id))
      .leftJoin(schema.images, eq(schema.dishes.id, schema.images.dishId));

  const { data: rawData } = useLiveTablesQuery(
    query,
    ['dishes', 'dishTags', 'tags', 'images'],
    [includeDeleted]
  );

  return useMemo(() => mapDishListRows(rawData ?? []), [rawData]);
};
