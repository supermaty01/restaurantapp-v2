import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

import { mapVisitListRows } from '../mappers/mapVisitListRows';
import { byNewestFirst } from '../utils/order';

import type { VisitListRow } from '../mappers/mapVisitListRows';

export const useVisitsByRestaurant = (restaurantId: number | undefined) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });

  const { data: rawData } = useLiveTablesQuery(
    restaurantId
      ? drizzleDb
          .select({
            visitId: schema.visits.id,
            visitedAt: schema.visits.visitedAt,
            visitComments: schema.visits.comments,
            restaurantId: schema.restaurants.id,
            restaurantName: schema.restaurants.name,
            imageId: schema.images.id,
            imagePath: schema.images.path,
          })
          .from(schema.visits)
          .where(eq(schema.visits.restaurantId, restaurantId))
          .leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
          .leftJoin(schema.images, eq(schema.visits.id, schema.images.visitId))
      : drizzleDb.select().from(schema.visits).where(eq(schema.visits.id, -1)), // Query vacía si no hay restaurantId
    ['visits', 'restaurants', 'images'],
    [restaurantId],
  );

  /*
   * De la más reciente a la más antigua.
   *
   * Salían en el orden en que SQLite las devolviera, que es el de inserción: en
   * un sitio al que vuelves, lo primero de la lista era la primera vez que
   * fuiste, hace años, y la de anoche quedaba al final. Un historial de un lugar
   * se lee siempre desde la última vez.
   */
  return useMemo(
    () => mapVisitListRows((rawData ?? []) as VisitListRow[]).sort(byNewestFirst),
    [rawData],
  );
};
