import { eq, isNull } from 'drizzle-orm';

import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';

import { importRestaurant } from './importService';

import type { ShareableRestaurant } from './types';

// expo-file-system is native ESM and only used for image files, which these
// tests don't exercise (empty images). Stub it so the module loads in node.
jest.mock('expo-file-system/legacy', () => ({}));

// A v1 .restoshare payload has no uuid/timestamps — the importer must backfill
// them (docs/09). Images are skipped here (they need the RN filesystem).
const v1Restaurant: ShareableRestaurant = {
  name: 'Guadalupe',
  latitude: 25.6,
  longitude: -100.3,
  comments: 'Importado desde v1',
  rating: 5,
  tags: [{ name: 'Favorito', color: '#ff0000' }],
  images: [],
};

describe('importService — v1 backfill', () => {
  it('imports a v1 restaurant with valid sync columns (no NULL uuid)', async () => {
    const { db } = makeTestDb();

    const id = await importRestaurant(db, v1Restaurant);
    expect(id).not.toBeNull();

    const [row] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, id!));
    expect(row?.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(row?.createdAt).toBeTruthy();
    // Lo importado de la v1 no eligió nada -- ese campo no existía --, así que
    // difiere al ajuste. Antes se quedaba clavado en 'private' y ningún cambio
    // de configuración lo alcanzaba, que es como un diario entero acababa
    // invisible para los amigos de su dueño.
    expect(row?.visibility).toBe('default');
  });

  it('leaves no row with a NULL uuid across entities', async () => {
    const { db } = makeTestDb();
    await importRestaurant(db, v1Restaurant);

    for (const table of [schema.restaurants, schema.tags]) {
      const nullUuid = await db.select().from(table).where(isNull(table.uuid));
      expect(nullUuid).toHaveLength(0);
    }
  });

  it('records change_log inserts for the imported rows', async () => {
    const { db } = makeTestDb();
    await importRestaurant(db, v1Restaurant);

    const inserts = await db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.operation, 'insert'));
    // restaurant + tag
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    expect(inserts.some((c) => c.tableName === 'restaurants')).toBe(true);
    expect(inserts.some((c) => c.tableName === 'tags')).toBe(true);
  });

  it('reuses an existing tag by name instead of duplicating', async () => {
    const { db } = makeTestDb();
    await importRestaurant(db, v1Restaurant);
    await importRestaurant(db, { ...v1Restaurant, name: 'Otro' });

    const favTags = await db.select().from(schema.tags).where(eq(schema.tags.name, 'Favorito'));
    expect(favTags).toHaveLength(1);
  });
});
