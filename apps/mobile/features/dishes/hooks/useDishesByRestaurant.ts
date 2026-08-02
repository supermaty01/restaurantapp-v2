import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import { scopedTo, useCurrentAccount } from '@/services/db/account-scope';
import * as schema from '@/services/db/schema';

import { mapDishListRows } from '../mappers/mapDishListRows';

export const useDishesByRestaurant = (
  restaurantId: number | undefined,
  includeDeleted: boolean = false,
) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const account = useCurrentAccount();

  // WHERE applies after the joins regardless of builder order, so joins are
  // chained first to keep the query fully typed (no `any` reassignment).
  const whereCondition = !restaurantId
    ? eq(schema.dishes.id, -1) // no restaurant selected → empty result
    : includeDeleted
      ? eq(schema.dishes.restaurantId, restaurantId)
      : and(eq(schema.dishes.restaurantId, restaurantId), eq(schema.dishes.deleted, false));

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
      tagDeleted: schema.tags.deleted,
      imageId: schema.images.id,
      imagePath: schema.images.path,
      imageRemoteKey: schema.images.remoteKey,
    })
    .from(schema.dishes)
    .leftJoin(schema.dishTags, eq(schema.dishes.id, schema.dishTags.dishId))
    .leftJoin(schema.tags, eq(schema.dishTags.tagId, schema.tags.id))
    .leftJoin(schema.images, eq(schema.dishes.id, schema.images.dishId))
    .where(scopedTo(schema.dishes.accountUuid, account, whereCondition));

  const { data: rawData } = useLiveTablesQuery(
    query,
    [schema.dishes, schema.dishTags, schema.tags, schema.images],
    [restaurantId, includeDeleted, account],
  );

  /*
   * Por orden alfabético.
   *
   * La carta de un sitio se recorre buscando un plato por su nombre, no por
   * cuándo lo apuntaste. `localeCompare` con 'es' para que las tildes y la ñ
   * caigan donde un lector español las busca, y no detrás de la z.
   */
  return useMemo(
    () => mapDishListRows(rawData ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [rawData],
  );
};
