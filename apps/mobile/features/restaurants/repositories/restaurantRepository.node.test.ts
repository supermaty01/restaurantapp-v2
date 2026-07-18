import { eq } from 'drizzle-orm';

import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';

import {
  canHardDeleteRestaurant,
  createRestaurant,
  softDeleteRestaurant,
  updateRestaurant,
} from './restaurantRepository';

const baseInput = {
  name: 'Guadalupe',
  comments: 'Rico',
  rating: 5,
  latitude: 25.6,
  longitude: -100.3,
};

async function countChangeLog(db: AppDatabase, op: 'insert' | 'update' | 'delete') {
  const rows = await db.select().from(schema.changeLog).where(eq(schema.changeLog.operation, op));
  return rows.length;
}

describe('restaurantRepository', () => {
  it('creates a restaurant with sync columns and a change_log insert', async () => {
    const { db } = makeTestDb();

    const id = await createRestaurant(db, baseInput);

    const [row] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, id));
    expect(row?.name).toBe('Guadalupe');
    expect(row?.uuid).toMatch(/[0-9a-f-]{36}/);
    expect(row?.createdAt).toBe(row?.updatedAt);
    expect(row?.visibility).toBe('private');

    const [log] = await db.select().from(schema.changeLog).where(eq(schema.changeLog.rowId, id));
    expect(log?.operation).toBe('insert');
    expect(log?.rowUuid).toBe(row?.uuid);
  });

  it('associates tags on create', async () => {
    const { db } = makeTestDb();
    const [tag] = await db
      .insert(schema.tags)
      .values({ name: 'Favorito', color: '#f00' })
      .returning({ id: schema.tags.id });

    const id = await createRestaurant(db, baseInput, [tag!.id]);

    const links = await db
      .select()
      .from(schema.restaurantTags)
      .where(eq(schema.restaurantTags.restaurantId, id));
    expect(links).toHaveLength(1);
    expect(links[0]?.tagId).toBe(tag!.id);
  });

  it('bumps updated_at and logs an update', async () => {
    const { db } = makeTestDb();
    const id = await createRestaurant(db, baseInput);
    const [before] = await db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, id));

    // Force a later timestamp than the create.
    await new Promise((r) => setTimeout(r, 5));
    await updateRestaurant(db, id, { ...baseInput, name: 'Guadalupe 2' });

    const [after] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, id));
    expect(after?.name).toBe('Guadalupe 2');
    expect(after?.updatedAt).not.toBe(before?.updatedAt);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(await countChangeLog(db, 'update')).toBe(1);
  });

  it('soft-deletes: keeps the row and logs a delete', async () => {
    const { db } = makeTestDb();
    const id = await createRestaurant(db, baseInput);

    await softDeleteRestaurant(db, id);

    const [row] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, id));
    expect(row?.deleted).toBe(true);
    expect(await countChangeLog(db, 'delete')).toBe(1);
  });

  it('canHardDeleteRestaurant is false when dishes/visits reference it', async () => {
    const { db } = makeTestDb();
    const id = await createRestaurant(db, baseInput);
    expect(await canHardDeleteRestaurant(db, id)).toBe(true);

    await db
      .insert(schema.dishes)
      .values({ name: 'Chihuahua', restaurantId: id, uuid: 'x', createdAt: 'x', updatedAt: 'x' });
    expect(await canHardDeleteRestaurant(db, id)).toBe(false);
  });
});
