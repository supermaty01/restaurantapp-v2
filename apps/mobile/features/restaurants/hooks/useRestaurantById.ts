import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { useMemo } from "react";

import { imagePathToUri } from "@/lib/helpers/image-paths";
import { useLiveTablesQuery } from "@/lib/hooks/useLiveTablesQuery";
import * as schema from "@/services/db/schema";

import { RestaurantDetailsDTO } from "../types/restaurant-dto";


export const useRestaurantById = (id: number, includeDeleted: boolean = true) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });

  const query = drizzleDb
    .select({
      restaurantId: schema.restaurants.id,
      restaurantName: schema.restaurants.name,
      restaurantComments: schema.restaurants.comments,
      restaurantRating: schema.restaurants.rating,
      restaurantLatitude: schema.restaurants.latitude,
      restaurantLongitude: schema.restaurants.longitude,
      restaurantDeleted: schema.restaurants.deleted,
      tagId: schema.tags.id,
      tagName: schema.tags.name,
      tagColor: schema.tags.color,
      imageId: schema.images.id,
      imagePath: schema.images.path,
    })
    .from(schema.restaurants);

  // Filtrar por ID y, opcionalmente, por estado de eliminación
  if (includeDeleted) {
    query.where(eq(schema.restaurants.id, id));
  } else {
    query.where(and(eq(schema.restaurants.id, id), eq(schema.restaurants.deleted, false)));
  }

  query.leftJoin(schema.restaurantTags, eq(schema.restaurants.id, schema.restaurantTags.restaurantId))
      .leftJoin(schema.tags, eq(schema.restaurantTags.tagId, schema.tags.id))
      .leftJoin(schema.images, eq(schema.restaurants.id, schema.images.restaurantId));

  const { data: rawData } = useLiveTablesQuery(
    query,
    ["restaurants", "restaurantTags", "tags", "images"],
    [id, includeDeleted]
  );

  const restaurant = useMemo(() => {
    const restaurants = rawData?.reduce<RestaurantDetailsDTO[]>((acc, row) => {
      let restaurant = acc.find((r) => r.id === row.restaurantId);
      if (!restaurant) {
        restaurant = {
          id: row.restaurantId,
          name: row.restaurantName,
          comments: row.restaurantComments,
          rating: row.restaurantRating,
          latitude: row.restaurantLatitude,
          longitude: row.restaurantLongitude,
          deleted: row.restaurantDeleted,
          tags: [],
          images: [],
        };
        acc.push(restaurant);
      }

      if (row.tagId && !restaurant.tags.some((t) => t.id === row.tagId)) {
        restaurant.tags.push({
          id: row.tagId,
          name: row.tagName!,
          color: row.tagColor!,
        });
      }

      if (row.imageId && !restaurant.images.some((i) => i.id === row.imageId)) {
        restaurant.images.push({
          id: row.imageId,
          uri: imagePathToUri(row.imagePath!),
        });
      }

      return acc;
    }, []);

    return restaurants?.[0];
  }, [rawData]);

  return restaurant;
};
