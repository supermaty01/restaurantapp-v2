import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import { scopedTo, useCurrentAccount } from '@/services/db/account-scope';
import * as schema from '@/services/db/schema';

import { mapVisitListRows } from '../mappers/mapVisitListRows';
import { byNewestFirst } from '../utils/order';

import type { VisitListRow } from '../mappers/mapVisitListRows';

export const useVisitsByRestaurant = (restaurantId: number | undefined) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const account = useCurrentAccount();

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
            imageRemoteKey: schema.images.remoteKey,
          })
          .from(schema.visits)
          .where(
            scopedTo(
              schema.visits.accountUuid,
              account,
              eq(schema.visits.restaurantId, restaurantId),
            ),
          )
          .leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
          .leftJoin(schema.images, eq(schema.visits.id, schema.images.visitId))
      : drizzleDb.select().from(schema.visits).where(eq(schema.visits.id, -1)), // Query vacía si no hay restaurantId
    [schema.visits, schema.restaurants, schema.images],
    [restaurantId, account],
  );

  // El orden va aquí y no en un `orderBy`: la consulta trae una fila por
  // (visita × foto) y el mapeador las pliega, así que ordenar en SQL ordenaría
  // las filas planas y no las visitas.
  return useMemo(
    () => mapVisitListRows((rawData ?? []) as VisitListRow[]).sort(byNewestFirst),
    [rawData],
  );
};
