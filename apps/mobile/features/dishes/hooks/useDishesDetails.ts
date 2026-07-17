import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

import { DishListRow, mapDishListRows } from '../mappers/mapDishListRows';

export const useDishesDetails = (dishIds: number[]) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });

  const { data: rawData } = useLiveTablesQuery(
    dishIds.length > 0
      ? drizzleDb
          .select({
            dishId: schema.dishes.id,
            dishName: schema.dishes.name,
            dishComments: schema.dishes.comments,
            dishRating: schema.dishes.rating,
            tagId: schema.tags.id,
            tagName: schema.tags.name,
            tagColor: schema.tags.color,
            imageId: schema.images.id,
            imagePath: schema.images.path,
          })
          .from(schema.dishes)
          .where(inArray(schema.dishes.id, dishIds))
          .leftJoin(schema.dishTags, eq(schema.dishes.id, schema.dishTags.dishId))
          .leftJoin(schema.tags, eq(schema.dishTags.tagId, schema.tags.id))
          .leftJoin(schema.images, eq(schema.dishes.id, schema.images.dishId))
      : drizzleDb.select().from(schema.dishes).where(eq(schema.dishes.id, -1)), // Query vacía si no hay dishIds
    ["dishes", "dishTags", "tags", "images"],
    [dishIds.join(",")]
  );

  return mapDishListRows((rawData ?? []) as DishListRow[]);
};
