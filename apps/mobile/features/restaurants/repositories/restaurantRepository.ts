import { eq } from 'drizzle-orm';

import type { Visibility } from '@/features/privacy/visibility';
import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

/**
 * All restaurant writes go through here so sync columns (uuid/created_at/
 * updated_at) and the change_log outbox stay consistent (docs/03). Screens must
 * not touch the DB directly.
 */

export interface RestaurantWriteInput {
  /** Who can see it. Omitted keeps whatever the row already had. */
  visibility?: Visibility;
  name: string;
  comments: string | null;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
}

export async function createRestaurant(
  db: AppDatabase,
  input: RestaurantWriteInput,
  tagIds: number[] = [],
): Promise<number> {
  const [row] = await db
    .insert(schema.restaurants)
    .values({ ...input, ...newSyncValues() })
    .returning({ id: schema.restaurants.id, uuid: schema.restaurants.uuid });

  if (!row) throw new Error('No se pudo crear el restaurante');

  await recordChange(db, 'restaurants', row.id, row.uuid, 'insert');
  await setRestaurantTags(db, row.id, tagIds);
  return row.id;
}

export async function updateRestaurant(
  db: AppDatabase,
  id: number,
  input: RestaurantWriteInput,
  tagIds: number[] = [],
): Promise<void> {
  const [row] = await db
    .update(schema.restaurants)
    .set({ ...input, ...touchedAt() })
    .where(eq(schema.restaurants.id, id))
    .returning({ uuid: schema.restaurants.uuid });

  if (!row) throw new Error('Restaurante no encontrado');

  await recordChange(db, 'restaurants', id, row.uuid, 'update');
  await setRestaurantTags(db, id, tagIds);
}

/** Soft-delete: keeps the row (and its uuid) so the deletion can be synced. */
export async function softDeleteRestaurant(db: AppDatabase, id: number): Promise<void> {
  const [row] = await db
    .update(schema.restaurants)
    .set({ deleted: true, ...touchedAt() })
    .where(eq(schema.restaurants.id, id))
    .returning({ uuid: schema.restaurants.uuid });

  if (row) await recordChange(db, 'restaurants', id, row.uuid, 'delete');
}

/** Replaces the restaurant's tag set with exactly `tagIds`. */
async function setRestaurantTags(db: AppDatabase, restaurantId: number, tagIds: number[]) {
  await db
    .delete(schema.restaurantTags)
    .where(eq(schema.restaurantTags.restaurantId, restaurantId));

  for (const tagId of tagIds) {
    await db.insert(schema.restaurantTags).values({ restaurantId, tagId });
  }
}

/** Whether a restaurant has no dishes/visits and can be hard-deleted. */
export async function canHardDeleteRestaurant(db: AppDatabase, id: number): Promise<boolean> {
  const dish = await db
    .select({ id: schema.dishes.id })
    .from(schema.dishes)
    .where(eq(schema.dishes.restaurantId, id))
    .limit(1);
  if (dish.length > 0) return false;

  const visit = await db
    .select({ id: schema.visits.id })
    .from(schema.visits)
    .where(eq(schema.visits.restaurantId, id))
    .limit(1);
  return visit.length === 0;
}

export async function hardDeleteRestaurant(db: AppDatabase, id: number): Promise<void> {
  const [row] = await db
    .select({ uuid: schema.restaurants.uuid })
    .from(schema.restaurants)
    .where(eq(schema.restaurants.id, id))
    .limit(1);

  await db.delete(schema.restaurantTags).where(eq(schema.restaurantTags.restaurantId, id));
  await db.delete(schema.restaurants).where(eq(schema.restaurants.id, id));

  if (row) await recordChange(db, 'restaurants', id, row.uuid, 'delete');
}
