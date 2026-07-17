import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

import { mapDishListRows } from '../mappers/mapDishListRows';

export const useDishesByRestaurant = (restaurantId: number | undefined, includeDeleted: boolean = false) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });

  let query: any = drizzleDb
    .select({
      dishId: schema.dishes.id,
      dishName: schema.dishes.name,
      dishComments: schema.dishes.comments,
      dishRating: schema.dishes.rating,
      dishDeleted: schema.dishes.deleted,
      tagId: schema.tags.id,
      tagName: schema.tags.name,
      tagColor: schema.tags.color,
      tagDeleted: schema.tags.deleted,
      imageId: schema.images.id,
      imagePath: schema.images.path,
    })
    .from(schema.dishes);

  if (restaurantId) {
    if (includeDeleted) {
      // Solo filtrar por restaurantId
      query = query.where(eq(schema.dishes.restaurantId, restaurantId));
    } else {
      // Filtrar por restaurantId y no eliminados
      query = query.where(and(
        eq(schema.dishes.restaurantId, restaurantId),
        eq(schema.dishes.deleted, false)
      ));
    }
  } else {
    // Si no hay restaurantId, devolver una consulta vacía
    query = query.where(eq(schema.dishes.id, -1));
  }

  query = query
    .leftJoin(schema.dishTags, eq(schema.dishes.id, schema.dishTags.dishId))
    .leftJoin(schema.tags, eq(schema.dishTags.tagId, schema.tags.id))
    .leftJoin(schema.images, eq(schema.dishes.id, schema.images.dishId));

  const { data: rawData } = useLiveTablesQuery(
    query,
    ["dishes", "dishTags", "tags", "images"],
    [restaurantId, includeDeleted]
  );

  return mapDishListRows(rawData ?? []);
};
