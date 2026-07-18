import { eq } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import { newSyncValues, recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';

export interface DishWriteInput {
  name: string;
  price: number | null;
  rating: number | null;
  comments: string | null;
  restaurantId: number;
}

export async function createDish(
  db: AppDatabase,
  input: DishWriteInput,
  tagIds: number[] = [],
): Promise<number> {
  const [row] = await db
    .insert(schema.dishes)
    .values({ ...input, ...newSyncValues() })
    .returning({ id: schema.dishes.id, uuid: schema.dishes.uuid });

  if (!row) throw new Error('No se pudo crear el plato');

  await recordChange(db, 'dishes', row.id, row.uuid, 'insert');
  await setDishTags(db, row.id, tagIds);
  return row.id;
}

export async function updateDish(
  db: AppDatabase,
  id: number,
  input: DishWriteInput,
  tagIds: number[] = [],
): Promise<void> {
  const [row] = await db
    .update(schema.dishes)
    .set({ ...input, ...touchedAt() })
    .where(eq(schema.dishes.id, id))
    .returning({ uuid: schema.dishes.uuid });

  if (!row) throw new Error('Plato no encontrado');

  await recordChange(db, 'dishes', id, row.uuid, 'update');
  await setDishTags(db, id, tagIds);
}

export async function softDeleteDish(db: AppDatabase, id: number): Promise<void> {
  const [row] = await db
    .update(schema.dishes)
    .set({ deleted: true, ...touchedAt() })
    .where(eq(schema.dishes.id, id))
    .returning({ uuid: schema.dishes.uuid });

  if (row) await recordChange(db, 'dishes', id, row.uuid, 'delete');
}

/** A dish can be hard-deleted only if no visit references it. */
export async function canHardDeleteDish(db: AppDatabase, id: number): Promise<boolean> {
  const link = await db
    .select({ dishId: schema.dishVisits.dishId })
    .from(schema.dishVisits)
    .where(eq(schema.dishVisits.dishId, id))
    .limit(1);
  return link.length === 0;
}

export async function hardDeleteDish(db: AppDatabase, id: number): Promise<void> {
  const [row] = await db
    .select({ uuid: schema.dishes.uuid })
    .from(schema.dishes)
    .where(eq(schema.dishes.id, id))
    .limit(1);

  await db.delete(schema.dishTags).where(eq(schema.dishTags.dishId, id));
  await db.delete(schema.dishes).where(eq(schema.dishes.id, id));

  if (row) await recordChange(db, 'dishes', id, row.uuid, 'delete');
}

async function setDishTags(db: AppDatabase, dishId: number, tagIds: number[]) {
  await db.delete(schema.dishTags).where(eq(schema.dishTags.dishId, dishId));
  for (const tagId of tagIds) {
    await db.insert(schema.dishTags).values({ dishId, tagId });
  }
}
