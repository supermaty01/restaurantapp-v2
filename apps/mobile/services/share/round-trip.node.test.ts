import { parseShareFile } from '@restaurantapp/shared';
import { eq } from 'drizzle-orm';

import { createDish } from '@/features/dishes/repositories/dishRepository';
import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { createTag } from '@/features/tags/repositories/tagRepository';
import { createVisit } from '@/features/visits/repositories/visitRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';

import { exportDish, exportRestaurant, exportVisit } from './exportService';
import {
  checkRestaurantConflict,
  importDishFile,
  importRestaurantFile,
  importVisitFile,
} from './importService';

/**
 * Exportar y volver a importar devuelve lo mismo.
 *
 * docs/12 lo exige y no existía. Es la prueba que sujeta la promesa más grande
 * de la app —«no vas a perder tu diario»— porque el `.restoshare` es lo que
 * viaja entre dos móviles y entre dos versiones. Un campo que se cae por el
 * camino no da error: da una entrada que llega a medias, y eso solo se descubre
 * mirando.
 *
 * El fichero se escribe de verdad: se sustituye `expo-file-system` por un mapa
 * en memoria en vez de saltarse `createAndShareFile`, para que lo que se
 * importa sea **el JSON que la app produce**, no un objeto construido en el
 * test. Saltárselo dejaría fuera justo lo que puede romperse: el serializado.
 *
 * Las fotos no entran: viajan en base64 y necesitan el sistema de ficheros
 * nativo. Lo que aquí se fija son los campos que describen la entrada.
 */
const files = new Map<string, string>();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  writeAsStringAsync: jest.fn((path: string, contents: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./round-trip.node.test') as { __files: Map<string, string> }).__files.set(
      path,
      contents,
    );
    return Promise.resolve();
  }),
  // Sin fotos en disco: `imageToBase64` devuelve null y la entrada viaja sin
  // imágenes, que es exactamente lo que este test quiere aislar.
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

/** Lo que el mock de `expo-file-system` escribe. Exportado para que lo alcance. */
export const __files = files;

/** Lee el `.restoshare` que acaba de escribir una exportación. */
function shareFileAt(path: string) {
  const contents = files.get(path);
  expect(contents).toBeDefined();
  const parsed = parseShareFile(JSON.parse(contents as string));
  if (!parsed.ok)
    throw new Error(`El fichero exportado no pasa su propio esquema: ${parsed.reason}`);
  return parsed.data;
}

async function seedRestaurant(db: AppDatabase) {
  const tagId = await createTag(db, { name: 'Favorito', color: '#C2603C' });
  return createRestaurant(
    db,
    {
      name: 'La Esquina',
      comments: 'De los de toda la vida',
      rating: 5,
      latitude: 6.25,
      longitude: -75.56,
    },
    [tagId],
  );
}

describe('el .restoshare va y vuelve', () => {
  beforeEach(() => files.clear());

  it('un restaurante conserva sus campos y sus etiquetas', async () => {
    const origin = makeTestDb();
    const id = await seedRestaurant(origin.db);

    const path = await exportRestaurant(origin.db, id);
    expect(path).not.toBeNull();
    const data = shareFileAt(path as string);
    expect(data.type).toBe('restaurant');

    // Otro móvil, vacío: es el caso que de verdad importa.
    const target = makeTestDb();
    const result = await importRestaurantFile(target.db, data);
    expect(result.success).toBe(true);

    const [row] = await target.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, result.entityId as number));

    expect(row?.name).toBe('La Esquina');
    expect(row?.comments).toBe('De los de toda la vida');
    expect(row?.rating).toBe(5);
    expect(row?.latitude).toBeCloseTo(6.25);
    expect(row?.longitude).toBeCloseTo(-75.56);

    const tags = await target.db.select().from(schema.tags);
    expect(tags.map((tag) => tag.name)).toEqual(['Favorito']);
  });

  it('un plato conserva su precio con decimales', async () => {
    // El caso que motivó la migración 0011: un `price integer` declarado
    // mientras la app escribe 3,50. Si el viaje lo redondea, el diario que
    // llega al otro móvil dice otro número.
    const origin = makeTestDb();
    const restaurantId = await seedRestaurant(origin.db);
    const dishId = await createDish(origin.db, {
      name: 'Croqueta',
      price: 3.5,
      rating: 4,
      comments: 'Crujiente',
      restaurantId,
    });

    const path = await exportDish(origin.db, dishId);
    const data = shareFileAt(path as string);

    const target = makeTestDb();
    const result = await importDishFile(target.db, data);
    expect(result.success).toBe(true);

    const [row] = await target.db
      .select()
      .from(schema.dishes)
      .where(eq(schema.dishes.id, result.entityId as number));

    expect(row?.price).toBe(3.5);
    expect(row?.rating).toBe(4);
    expect(row?.comments).toBe('Crujiente');
  });

  it('una visita se lleva su restaurante y sus platos', async () => {
    const origin = makeTestDb();
    const restaurantId = await seedRestaurant(origin.db);
    const dishId = await createDish(origin.db, {
      name: 'Amatriciana',
      price: 12,
      rating: 5,
      comments: null,
      restaurantId,
    });
    const visitId = await createVisit(
      origin.db,
      { visitedAt: '2026-07-01', comments: 'Comimos bien', restaurantId },
      [dishId],
    );

    const path = await exportVisit(origin.db, visitId);
    const data = shareFileAt(path as string);

    const target = makeTestDb();
    const result = await importVisitFile(target.db, data);
    expect(result.success).toBe(true);

    const [row] = await target.db
      .select()
      .from(schema.visits)
      .where(eq(schema.visits.id, result.entityId as number));

    expect(row?.comments).toBe('Comimos bien');
    expect(row?.visitedAt).toBe('2026-07-01');

    // El restaurante viaja dentro: sin él la visita llega huérfana y la
    // pantalla de detalle no tiene nombre que enseñar.
    const restaurants = await target.db.select().from(schema.restaurants);
    expect(restaurants.map((r) => r.name)).toEqual(['La Esquina']);

    const dishes = await target.db.select().from(schema.dishes);
    expect(dishes.map((d) => d.name)).toEqual(['Amatriciana']);

    const links = await target.db.select().from(schema.dishVisits);
    expect(links).toHaveLength(1);
  });

  it('el segundo import del mismo fichero avisa del choque en vez de duplicar en silencio', async () => {
    /*
     * Esto es lo que docs/12 llama «idempotente», y conviene precisar qué
     * significa aquí: **no** que el importador deduplique por su cuenta —dos
     * restaurantes pueden llamarse igual y fusionarlos sería inventarse una
     * decisión— sino que reenviarse el mismo `.restoshare` no acaba en dos
     * copias sin que nadie lo haya elegido. El importador detecta el choque y
     * la pantalla pregunta; resolverlo como «es el mismo» no crea nada nuevo.
     */
    const origin = makeTestDb();
    const id = await seedRestaurant(origin.db);
    const data = shareFileAt((await exportRestaurant(origin.db, id)) as string);

    const target = makeTestDb();
    const first = await importRestaurantFile(target.db, data);
    expect(first.success).toBe(true);

    const conflict = await checkRestaurantConflict(target.db, data.restaurant!.name);
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.existingEntity?.id).toBe(first.entityId);

    const second = await importRestaurantFile(target.db, data, {
      type: 'use_existing',
      existingId: first.entityId as number,
    });
    expect(second.success).toBe(true);

    const restaurants = await target.db.select().from(schema.restaurants);
    expect(restaurants).toHaveLength(1);
    // Y las etiquetas se reutilizan por nombre, sin preguntar: una etiqueta es
    // su nombre, no una entidad con vida propia.
    const tags = await target.db.select().from(schema.tags);
    expect(tags).toHaveLength(1);
  });
});
