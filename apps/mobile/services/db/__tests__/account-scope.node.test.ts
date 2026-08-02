import { eq } from 'drizzle-orm';

import { ownedBy, scopedTo } from '@/services/db/account-scope';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';

import { makeTestDb } from './test-db';

/**
 * Qué ve cada cuenta, contra SQLite de verdad.
 *
 * El contrato de al lado comprueba que el filtro **está**; esto comprueba que
 * **dice lo que creemos**. Los dos hacen falta y por separado: un `or` mal
 * puesto pasa el primero sin despeinarse, porque el filtro está escrito — solo
 * que deja pasar el diario entero.
 *
 * Los tres casos son los que se reportaron al probar dos cuentas en el mismo
 * móvil, en el orden en que se vivieron.
 */
const ANA = 'aaaaaaaa-0000-4000-8000-000000000001';
const BEA = 'bbbbbbbb-0000-4000-8000-000000000002';

async function seed(db: AppDatabase) {
  await db.insert(schema.restaurants).values([
    { name: 'De Ana', accountUuid: ANA, uuid: 'r-ana', createdAt: 'x', updatedAt: 'x' },
    { name: 'De Bea', accountUuid: BEA, uuid: 'r-bea', createdAt: 'x', updatedAt: 'x' },
    // Sin cuenta: escrita antes de entrar, o mientras la sesión se recuperaba
    // al arrancar. `linkLocalData` la reclamará en el siguiente push.
    { name: 'Huérfana', accountUuid: null, uuid: 'r-none', createdAt: 'x', updatedAt: 'x' },
    // Borrada de Ana, para comprobar que el filtro de cuenta **se suma** al que
    // ya hubiera y no lo sustituye.
    {
      name: 'Borrada',
      accountUuid: ANA,
      deleted: true,
      uuid: 'r-del',
      createdAt: 'x',
      updatedAt: 'x',
    },
  ]);
}

async function namesVisibleTo(db: AppDatabase, account: string | null) {
  const rows = await db
    .select({ name: schema.restaurants.name })
    .from(schema.restaurants)
    .where(ownedBy(schema.restaurants.accountUuid, account));
  return rows.map((row) => row.name).sort();
}

describe('ownedBy', () => {
  it('sin sesión solo enseña lo que no es de ninguna cuenta', async () => {
    const { db } = makeTestDb();
    await seed(db);

    // Éste es el segundo síntoma que se reportó: «cerré sesión y seguía viendo
    // todo». Ahora cerrar sesión vacía la pantalla, que es la semántica
    // correcta — las filas quedaron selladas y vuelven al volver a entrar.
    expect(await namesVisibleTo(db, null)).toEqual(['Huérfana']);
  });

  it('con una cuenta enseña la suya y las huérfanas, nunca las ajenas', async () => {
    const { db } = makeTestDb();
    await seed(db);

    expect(await namesVisibleTo(db, ANA)).toEqual(['Borrada', 'De Ana', 'Huérfana']);
    expect(await namesVisibleTo(db, BEA)).toEqual(['De Bea', 'Huérfana']);
  });

  it('una cuenta recién creada no ve el diario de la otra', async () => {
    const { db } = makeTestDb();
    await seed(db);

    // El síntoma tal cual: «la primera cuenta tiene todos mis datos, la segunda
    // es recién creada, y aún veía todo».
    expect(await namesVisibleTo(db, BEA)).not.toContain('De Ana');
  });

  it('las huérfanas se ven mientras la sesión se recupera', async () => {
    const { db } = makeTestDb();
    await seed(db);

    // No es laxitud: `getCurrentAccount()` devuelve null durante el arranque, y
    // sin este caso las filas escritas en ese hueco desaparecerían de la
    // pantalla unos segundos en cada arranque.
    expect(await namesVisibleTo(db, ANA)).toContain('Huérfana');
  });
});

describe('scopedTo', () => {
  it('suma el filtro de cuenta al que ya tenía la consulta', async () => {
    const { db } = makeTestDb();
    await seed(db);

    const rows = await db
      .select({ name: schema.restaurants.name })
      .from(schema.restaurants)
      .where(scopedTo(schema.restaurants.accountUuid, ANA, eq(schema.restaurants.deleted, false)));

    // Ni la borrada (la condición de antes) ni la de Bea (la nueva). Que las dos
    // sigan en pie es lo que este test protege: sustituir una por otra es un
    // cambio de una línea que no falla en ninguna parte.
    expect(rows.map((row) => row.name).sort()).toEqual(['De Ana', 'Huérfana']);
  });

  it('sin condición previa se comporta como ownedBy', async () => {
    const { db } = makeTestDb();
    await seed(db);

    const rows = await db
      .select({ name: schema.restaurants.name })
      .from(schema.restaurants)
      .where(scopedTo(schema.restaurants.accountUuid, BEA));

    expect(rows.map((row) => row.name).sort()).toEqual(['De Bea', 'Huérfana']);
  });
});
