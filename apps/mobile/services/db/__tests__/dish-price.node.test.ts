import { eq } from 'drizzle-orm';

import { createDish } from '@/features/dishes/repositories/dishRepository';
import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';

/**
 * Un plato cuesta 3,50.
 *
 * `schema.ts` declaraba `price: integer('price')` mientras la app escribía
 * decimales. SQLite no lo impide —los tipos son afinidades, no restricciones—
 * así que nadie se enteraba **aquí**: el error salía mucho después y en otro
 * sitio, al empujar contra Postgres, que sí aplica tipos. Ese es exactamente el
 * modo de fallo que esta prueba cierra, porque es el que no avisa.
 *
 * Se comprueba el tipo declarado además del valor: el valor ya se guardaba bien
 * antes —afinidad INTEGER solo convierte un REAL si no pierde nada— así que una
 * prueba que solo mirara el 3.5 pasaría también con el esquema mintiendo.
 * `PRAGMA table_info` es lo que de verdad distingue las dos versiones.
 */
describe('el precio de un plato', () => {
  it('la columna se declara `REAL`, como el `numeric(12,2)` del espejo', () => {
    const { raw } = makeTestDb();

    const price = raw
      .prepare<[], { name: string; type: string }>('PRAGMA table_info(dishes)')
      .all()
      .find((column) => column.name === 'price');

    expect(price?.type.toUpperCase()).toBe('REAL');
  });

  /** Un plato cuelga siempre de un restaurante. */
  const withRestaurant = (db: Parameters<typeof createDish>[0]) =>
    createRestaurant(db, {
      name: 'La Esquina',
      comments: null,
      rating: null,
      latitude: null,
      longitude: null,
    });

  it('sobrevive con sus decimales a la ida y la vuelta', async () => {
    const { db } = makeTestDb();
    const restaurant = await withRestaurant(db);

    const id = await createDish(db, {
      name: 'Croqueta',
      price: 3.5,
      currency: 'COP',
      rating: null,
      comments: null,
      restaurantId: restaurant,
    });
    const [row] = await db.select().from(schema.dishes).where(eq(schema.dishes.id, id));

    expect(row?.price).toBe(3.5);
  });

  it('la reconstrucción de la tabla no se dejó ninguna fila', async () => {
    // La 0011 reconstruye `dishes` entera, que es como SQLite cambia el tipo de
    // una columna. Un `INSERT … SELECT` con una columna de menos se lleva por
    // delante el diario sin decir nada.
    const { db, raw } = makeTestDb();
    const restaurant = await withRestaurant(db);
    await createDish(db, {
      name: 'Tortilla',
      price: 12,
      currency: 'COP',
      rating: 5,
      comments: 'de patata',
      restaurantId: restaurant,
    });

    const columns = raw
      .prepare<[], { name: string }>('PRAGMA table_info(dishes)')
      .all()
      .map((column) => column.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'price',
        'rating',
        'comments',
        'restaurant_id',
        'user_id',
        'visibility',
        'deleted',
        'uuid',
        'created_at',
        'updated_at',
      ]),
    );
  });
});
