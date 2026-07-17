import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

import { mapVisitListRows } from '../mappers/mapVisitListRows';

export const useVisitList = (includeDeleted: boolean = false) => {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);

  const query = drizzleDb
    .select({
      visitId: schema.visits.id,
      visitedAt: schema.visits.visitedAt,
      visitComments: schema.visits.comments,
      visitDeleted: schema.visits.deleted,
      restaurantId: schema.restaurants.id,
      restaurantName: schema.restaurants.name,
      restaurantDeleted: schema.restaurants.deleted,
      imageId: schema.images.id,
      imagePath: schema.images.path,
    })
    .from(schema.visits);

  if (!includeDeleted) {
    query.where(eq(schema.visits.deleted, false));
  }

  query.leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
      .leftJoin(schema.images, eq(schema.visits.id, schema.images.visitId));

  const { data: rawData } = useLiveTablesQuery(
    query,
    ['visits', 'restaurants', 'images'],
    [includeDeleted]
  );

  return useMemo(() => mapVisitListRows(rawData ?? []), [rawData]);
};
