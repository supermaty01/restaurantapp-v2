import { eq, and, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";

import { useLiveTablesQuery } from "@/lib/hooks/useLiveTablesQuery";
import * as schema from "@/services/db/schema";

export interface RestaurantMapDTO {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  rating: number | null;
}

export const useRestaurantMapList = () => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });

  const query = drizzleDb
    .select({
      id: schema.restaurants.id,
      name: schema.restaurants.name,
      latitude: schema.restaurants.latitude,
      longitude: schema.restaurants.longitude,
      rating: schema.restaurants.rating,
    })
    .from(schema.restaurants)
    .where(
      and(
        eq(schema.restaurants.deleted, false),
        isNotNull(schema.restaurants.latitude),
        isNotNull(schema.restaurants.longitude)
      )
    );

  const { data: rawData } = useLiveTablesQuery(query, ["restaurants"]);

  const restaurants: RestaurantMapDTO[] = (rawData ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    latitude: row.latitude!,
    longitude: row.longitude!,
    rating: row.rating,
  }));

  return restaurants;
};

