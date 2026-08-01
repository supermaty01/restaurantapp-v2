import { eq, isNull } from 'drizzle-orm';

import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import {
  getCurrentAccount,
  resetCurrentAccountForTests,
  setCurrentAccount,
} from '@/services/db/account-store';
import * as schema from '@/services/db/schema';
import { linkLocalData } from '@/services/sync/linkLocalData';
import { SYNC_TABLES, column } from '@/services/sync/tables';

/**
 * De quién es cada fila.
 *
 * Primera mitad de «dos cuentas en el mismo móvil». Aquí solo se comprueba que
 * el dato **se escribe bien**; todavía no filtra ninguna lectura, así que nada
 * de esto cambia lo que se ve. Se separa a propósito: una migración que
 * escribe y no lee es inofensiva, mientras que filtrar a medias esconde
 * diarios.
 *
 * Lo que se sujeta:
 *
 * - Sin sesión, `null`. Es un estado normal, no un hueco: es lo que tiene un
 *   diario sin cuenta, que es el modo en que la app funciona entera.
 * - Con sesión, la cuenta, **sin que el repositorio sepa nada de cuentas**. Es
 *   lo que se gana pasándolo por el store en vez de por la firma de cada
 *   `create*`: olvidarse en un sitio dejaría de ser posible.
 * - Iniciar sesión reclama lo huérfano, y **solo lo huérfano**. Una fila de A
 *   que se volviera de B al entrar con B no es reclamar, es robar.
 */
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const nuevo = (name: string) => ({
  name,
  comments: null,
  rating: null,
  latitude: null,
  longitude: null,
});

describe('el sello de cuenta', () => {
  beforeEach(() => resetCurrentAccountForTests());
  afterAll(() => resetCurrentAccountForTests());

  it('las seis tablas sincronizables tienen la columna', () => {
    // Si una se queda fuera, sus filas serían invisibles para todas las cuentas
    // en cuanto las lecturas filtren — y eso sí que no daría ningún error.
    const { raw } = makeTestDb();

    for (const cfg of SYNC_TABLES) {
      const columns = raw
        .prepare<[], { name: string }>(`PRAGMA table_info(${cfg.name})`)
        .all()
        .map((c) => c.name);
      expect(columns).toContain('account_uuid');
    }
  });

  it('sin sesión, una fila nueva no es de nadie', async () => {
    const { db } = makeTestDb();

    const id = await createRestaurant(db, nuevo('La Esquina'));

    const [row] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, id));
    expect(row?.accountUuid).toBeNull();
  });

  it('con sesión, la fila nace sellada — y el repositorio no sabe de cuentas', async () => {
    const { db } = makeTestDb();
    setCurrentAccount(A);

    // La firma de `createRestaurant` no menciona ninguna cuenta. Ese es el
    // punto: el sello no depende de que quien escribe se acuerde.
    const id = await createRestaurant(db, nuevo('La Esquina'));

    const [row] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, id));
    expect(row?.accountUuid).toBe(A);
  });

  it('iniciar sesión reclama lo que no era de nadie', async () => {
    // El caso 1 de docs/04: escribes un diario sin cuenta y luego creas una.
    const { db } = makeTestDb();
    await createRestaurant(db, nuevo('De antes'));

    setCurrentAccount(A);
    await linkLocalData(db);

    const huerfanas = await db
      .select()
      .from(schema.restaurants)
      .where(isNull(schema.restaurants.accountUuid));
    expect(huerfanas).toHaveLength(0);
  });

  it('y no reclama lo que es de otra cuenta', async () => {
    const { db } = makeTestDb();
    setCurrentAccount(A);
    const deA = await createRestaurant(db, nuevo('De A'));

    setCurrentAccount(B);
    await linkLocalData(db);

    const [row] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, deA));
    expect(row?.accountUuid).toBe(A);
  });

  it('sin sesión, reclamar no hace nada', async () => {
    const { db } = makeTestDb();
    await createRestaurant(db, nuevo('Sin dueño'));

    await linkLocalData(db);

    expect(getCurrentAccount()).toBeNull();
    const [row] = await db.select().from(schema.restaurants);
    expect(row?.accountUuid).toBeNull();
  });

  it('la columna existe en el objeto de tabla de todas ellas', () => {
    // El acceso dinámico de `linkLocalData` es por nombre: si una tabla no la
    // declarara en `schema.ts`, fallaría en tiempo de ejecución y solo al
    // sincronizar.
    for (const cfg of SYNC_TABLES) {
      expect(() => column(cfg.table, 'accountUuid')).not.toThrow();
      expect(column(cfg.table, 'accountUuid')).toBeDefined();
    }
  });
});
