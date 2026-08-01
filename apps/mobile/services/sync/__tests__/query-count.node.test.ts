import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine } from '@/services/sync/engine';

import { FakeServer } from './fake-transport';

import type Database from 'better-sqlite3';

/**
 * Cuántas veces habla el sync con SQLite.
 *
 * Los demás tests del motor comprueban que el resultado es correcto, y lo era
 * también antes: traducir las claves ajenas de una en una da exactamente las
 * mismas filas que traducirlas por lotes. Lo que no se veía en ninguna prueba
 * es lo que costaba.
 *
 * `toRemoteRecord` y `applyRemoteRecord` hacían un `select … limit 1` **por cada
 * clave ajena de cada fila**, y el push además uno por cada uuid pendiente antes
 * de empezar. Con `images`, que tiene tres claves ajenas, bajar una página de
 * quinientas filas eran del orden de dos mil consultas para traducir unos pocos
 * cientos de uuids distintos — porque un diario tiene muchas visitas a pocos
 * restaurantes, así que la inmensa mayoría de esas preguntas repetían una
 * respuesta que ya se sabía.
 *
 * Esta prueba fija el orden de magnitud. No persigue un número exacto —eso se
 * rompería con cualquier refactor honesto— sino la diferencia entre «unas pocas
 * consultas por tabla» y «una por fila», que es la que decide si restaurar un
 * diario en un móvil nuevo tarda segundos o minutos.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

/** Cuenta las sentencias que llegan de verdad a SQLite. */
function countQueries(raw: Database.Database) {
  const seen: string[] = [];
  const original = raw.prepare.bind(raw);

  raw.prepare = ((sql: string) => {
    const statement = original(sql);
    for (const method of ['all', 'get', 'run'] as const) {
      const fn = statement[method].bind(statement);
      // @ts-expect-error -- se reemplaza el método para contar, misma firma
      statement[method] = (...args: unknown[]) => {
        seen.push(sql);
        return fn(...(args as []));
      };
    }
    return statement;
  }) as typeof raw.prepare;

  return {
    /** Las sentencias vistas desde el último `reset`, filtradas. */
    matching: (pattern: RegExp) => seen.filter((sql) => pattern.test(sql)),
    reset: () => {
      seen.length = 0;
    },
  };
}

/** Un diario ya sincronizado: pocos restaurantes, muchos platos en ellos. */
async function seedRemote(server: FakeServer, restaurants: number, dishesEach: number) {
  const now = new Date().toISOString();

  for (let r = 0; r < restaurants; r++) {
    const uuid = `aaaaaaaa-0000-4000-8000-${String(r).padStart(12, '0')}`;
    server.upsert('restaurants', [
      {
        uuid,
        user_id: ACCOUNT,
        name: `Sitio ${String(r)}`,
        visibility: 'private',
        deleted: false,
        created_at: now,
        updated_at: now,
      },
    ]);

    for (let d = 0; d < dishesEach; d++) {
      server.upsert('dishes', [
        {
          uuid: `bbbbbbbb-${String(r).padStart(4, '0')}-4000-8000-${String(d).padStart(12, '0')}`,
          user_id: ACCOUNT,
          restaurant_uuid: uuid,
          name: `Plato ${String(r)}-${String(d)}`,
          visibility: 'private',
          deleted: false,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  }
}

describe('cuántas consultas cuesta un sync', () => {
  it('el pull no hace una consulta por clave ajena', async () => {
    const { db, raw } = makeTestDb();
    const server = new FakeServer();
    const counter = countQueries(raw);

    // 5 restaurantes con 20 platos cada uno: 100 platos, todos apuntando a solo
    // cinco uuids distintos. Es la forma que tiene un diario de verdad.
    await seedRemote(server, 5, 20);

    counter.reset();
    await new SyncEngine(db as AppDatabase, server.transport(), ACCOUNT).pull();

    // Las 100 filas de dishes se insertan, así que las inserciones sí escalan
    // con las filas. Lo que no debe escalar es la **traducción**: buscar en
    // `restaurants` por uuid para resolver `restaurant_uuid`.
    const lookups = counter.matching(/select.*from "restaurants".*where.*"uuid"/is);

    expect(lookups.length).toBeLessThan(10);

    // Y el resultado tiene que seguir siendo correcto: cada plato con su sitio.
    const dishes = await db.select().from(schema.dishes);
    expect(dishes).toHaveLength(100);
    expect(dishes.every((dish) => dish.restaurantId !== null)).toBe(true);
  });

  it('el push no hace una consulta por fila pendiente', async () => {
    const { db, raw } = makeTestDb();
    const server = new FakeServer();

    await seedRemote(server, 5, 20);
    const engine = new SyncEngine(db as AppDatabase, server.transport(), ACCOUNT);
    await engine.pull();

    // Todo lo bajado se marca como pendiente otra vez, que es lo que pasa
    // cuando alguien inicia sesión con un diario que ya tenía.
    await db.update(schema.changeLog).set({ synced: false });

    const counter = countQueries(raw);
    counter.reset();
    await engine.push();

    // Antes: un `select … limit 1` por cada uuid pendiente, 105 en total.
    const rowReads = counter.matching(/select.*from "dishes".*where.*"uuid"/is);
    expect(rowReads.length).toBeLessThan(10);
  });
});
