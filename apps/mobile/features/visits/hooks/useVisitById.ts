import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { useMemo } from "react";

import { imagePathToUri } from "@/lib/helpers/image-paths";
import { useLiveTablesQuery } from "@/lib/hooks/useLiveTablesQuery";
import * as schema from "@/services/db/schema";

import { VisitDetailsDTO } from "../types/visit-dto";


export const useVisitById = (id: number, includeDeleted: boolean = true) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });

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
      dishId: schema.dishes.id,
      dishName: schema.dishes.name,
      dishDeleted: schema.dishes.deleted,
    })
    .from(schema.visits);

  // Filtrar por ID y, opcionalmente, por estado de eliminación
  if (includeDeleted) {
    query.where(eq(schema.visits.id, id));
  } else {
    query.where(and(eq(schema.visits.id, id), eq(schema.visits.deleted, false)));
  }

  query.leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
      .leftJoin(schema.images, eq(schema.visits.id, schema.images.visitId))
      .leftJoin(schema.dishVisits, eq(schema.visits.id, schema.dishVisits.visitId))
      .leftJoin(schema.dishes, eq(schema.dishVisits.dishId, schema.dishes.id));

  const { data: rawData } = useLiveTablesQuery(
    query,
    ["visits", "restaurants", "images", "dishVisits", "dishes"],
    [id, includeDeleted]
  );

  const visit = useMemo(() => {
    const visits = rawData?.reduce<VisitDetailsDTO[]>((acc, row) => {
      let visit = acc.find((v) => v.id === row.visitId);
      if (!visit) {
        visit = {
          id: row.visitId,
          visited_at: row.visitedAt,
          comments: row.visitComments,
          deleted: row.visitDeleted,
          restaurant: {
            id: row.restaurantId!,
            name: row.restaurantName!,
            deleted: row.restaurantDeleted,
          },
          images: [],
          dishes: [],
        };
        acc.push(visit);
      }

      if (row.imageId && !visit.images.some((i) => i.id === row.imageId)) {
        visit.images.push({
          id: row.imageId,
          uri: imagePathToUri(row.imagePath!),
        });
      }

      if (row.dishId && !visit.dishes.some((d) => d.id === row.dishId)) {
        visit.dishes.push({
          id: row.dishId,
          name: row.dishName!,
          deleted: row.dishDeleted,
        });
      }

      return acc;
    }, []);

    return visits?.[0];
  }, [rawData]);

  return visit;
};
