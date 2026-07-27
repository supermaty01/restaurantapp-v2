import { count, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { formatDate } from '@/lib/helpers/date';
import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

import { collapseRegistrationSessions, type RecentEntry } from '../recentEntries';

export type { RecentEntry } from '../recentEntries';

/**
 * The numbers and the short list the home dashboard shows.
 *
 * Counted in SQL rather than by loading the lists and taking `.length`: a real
 * diary has thousands of rows and the home screen has no use for any of them
 * beyond the most recent handful.
 */
export function useHomeSummary(recentLimit = 3) {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);

  const countsQuery = useMemo(
    () =>
      drizzleDb
        .select({
          restaurants: count(schema.restaurants.id),
        })
        .from(schema.restaurants)
        .where(eq(schema.restaurants.deleted, false)),
    [drizzleDb],
  );

  const dishCountQuery = useMemo(
    () =>
      drizzleDb
        .select({ dishes: count(schema.dishes.id) })
        .from(schema.dishes)
        .where(eq(schema.dishes.deleted, false)),
    [drizzleDb],
  );

  const visitCountQuery = useMemo(
    () =>
      drizzleDb
        .select({ visits: count(schema.visits.id) })
        .from(schema.visits)
        .where(eq(schema.visits.deleted, false)),
    [drizzleDb],
  );

  /*
   * Lo reciente ya no son "las últimas visitas".
   *
   * Quien no registra visitas —y es normal, cada quien apunta lo que le sirve—
   * veía una sección permanentemente vacía o con lo mismo de hace meses. Ahora
   * es lo último que añadiste, sea de la clase que sea, y `recentEntries` se
   * encarga de que una comida registrada entera no ocupe tres huecos.
   *
   * Se pide de más a cada tabla porque el colapso descarta: sin margen, una
   * sesión que crea visita, plato y restaurante dejaría la sección con una sola
   * entrada.
   */
  const overFetch = recentLimit * 4;

  const recentVisitsQuery = useMemo(
    () =>
      drizzleDb
        .select({
          id: schema.visits.id,
          createdAt: schema.visits.createdAt,
          visitedAt: schema.visits.visitedAt,
          comments: schema.visits.comments,
          restaurantId: schema.visits.restaurantId,
          restaurantName: schema.restaurants.name,
        })
        .from(schema.visits)
        .leftJoin(schema.restaurants, eq(schema.visits.restaurantId, schema.restaurants.id))
        .where(eq(schema.visits.deleted, false))
        .orderBy(desc(schema.visits.createdAt), desc(schema.visits.id))
        .limit(overFetch),
    [drizzleDb, overFetch],
  );

  const recentDishesQuery = useMemo(
    () =>
      drizzleDb
        .select({
          id: schema.dishes.id,
          createdAt: schema.dishes.createdAt,
          name: schema.dishes.name,
          restaurantId: schema.dishes.restaurantId,
          restaurantName: schema.restaurants.name,
        })
        .from(schema.dishes)
        .leftJoin(schema.restaurants, eq(schema.dishes.restaurantId, schema.restaurants.id))
        .where(eq(schema.dishes.deleted, false))
        .orderBy(desc(schema.dishes.createdAt), desc(schema.dishes.id))
        .limit(overFetch),
    [drizzleDb, overFetch],
  );

  const recentRestaurantsQuery = useMemo(
    () =>
      drizzleDb
        .select({
          id: schema.restaurants.id,
          createdAt: schema.restaurants.createdAt,
          name: schema.restaurants.name,
        })
        .from(schema.restaurants)
        .where(eq(schema.restaurants.deleted, false))
        .orderBy(desc(schema.restaurants.createdAt), desc(schema.restaurants.id))
        .limit(overFetch),
    [drizzleDb, overFetch],
  );

  /** Qué platos cuelgan de qué visita, para poder absorberlos. */
  const dishLinksQuery = useMemo(
    () =>
      drizzleDb
        .select({ visitId: schema.dishVisits.visitId, dishId: schema.dishVisits.dishId })
        .from(schema.dishVisits),
    [drizzleDb],
  );

  /** Una foto por entidad; la primera vale. */
  const imagesQuery = useMemo(
    () =>
      drizzleDb
        .select({
          path: schema.images.path,
          visitId: schema.images.visitId,
          dishId: schema.images.dishId,
          restaurantId: schema.images.restaurantId,
        })
        .from(schema.images),
    [drizzleDb],
  );

  const { data: restaurantRows } = useLiveTablesQuery(countsQuery, ['restaurants']);
  const { data: dishRows } = useLiveTablesQuery(dishCountQuery, ['dishes']);
  const { data: visitRows } = useLiveTablesQuery(visitCountQuery, ['visits']);
  const { data: recentVisits } = useLiveTablesQuery(recentVisitsQuery, ['visits', 'restaurants']);
  const { data: recentDishes } = useLiveTablesQuery(recentDishesQuery, ['dishes', 'restaurants']);
  const { data: recentRestaurants } = useLiveTablesQuery(recentRestaurantsQuery, ['restaurants']);
  const { data: dishLinks } = useLiveTablesQuery(dishLinksQuery, ['dish_visit']);
  const { data: imageRows } = useLiveTablesQuery(imagesQuery, ['images']);

  const recent = useMemo(() => {
    const firstImage = (key: 'visitId' | 'dishId' | 'restaurantId', id: number) =>
      (imageRows ?? []).find((image) => image[key] === id)?.path ?? null;

    // `dish_visit` permite nulos en el esquema local (viene de v1), así que un
    // enlace a medias se ignora en vez de reventar el agrupado.
    const dishesOfVisit = new Map<number, number[]>();
    for (const link of dishLinks ?? []) {
      if (link.visitId === null || link.dishId === null) continue;
      dishesOfVisit.set(link.visitId, [...(dishesOfVisit.get(link.visitId) ?? []), link.dishId]);
    }

    const entries: RecentEntry[] = [
      ...(recentVisits ?? []).map((row) => ({
        kind: 'visit' as const,
        id: row.id,
        createdAt: row.createdAt,
        title: row.restaurantName ?? 'Una visita',
        // Lo que la visita añade sobre su título: cuándo fue y qué contaste.
        detail: [row.visitedAt ? formatDate(row.visitedAt) : null, row.comments]
          .filter(Boolean)
          .join(' · '),
        imagePath: firstImage('visitId', row.id),
        restaurantId: row.restaurantId,
        dishIds: dishesOfVisit.get(row.id) ?? [],
      })),
      ...(recentDishes ?? []).map((row) => ({
        kind: 'dish' as const,
        id: row.id,
        createdAt: row.createdAt,
        title: row.name,
        detail: row.restaurantName,
        imagePath: firstImage('dishId', row.id),
        restaurantId: row.restaurantId,
        dishIds: [],
      })),
      ...(recentRestaurants ?? []).map((row) => ({
        kind: 'restaurant' as const,
        id: row.id,
        createdAt: row.createdAt,
        title: row.name,
        detail: null,
        imagePath: firstImage('restaurantId', row.id),
        restaurantId: row.id,
        dishIds: [],
      })),
    ];

    return collapseRegistrationSessions(entries, recentLimit);
  }, [recentVisits, recentDishes, recentRestaurants, dishLinks, imageRows, recentLimit]);

  return {
    restaurants: restaurantRows?.[0]?.restaurants ?? 0,
    dishes: dishRows?.[0]?.dishes ?? 0,
    visits: visitRows?.[0]?.visits ?? 0,
    recent,
  };
}
