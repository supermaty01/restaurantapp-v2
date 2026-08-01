import { eq } from 'drizzle-orm';

import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine } from '@/services/sync/engine';
import {
  applyDivergenceChoice,
  needsDivergenceChoice,
  rememberAccountLinked,
} from '@/services/sync/resolveDivergence';

import { FakeServer } from './fake-transport';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

function engineFor(db: AppDatabase, server: FakeServer) {
  return new SyncEngine(db, server.transport(), ACCOUNT);
}

async function addRestaurant(db: AppDatabase, name: string) {
  await createRestaurant(db, {
    name,
    comments: null,
    rating: 4,
    latitude: null,
    longitude: null,
  });
}

async function names(db: AppDatabase): Promise<string[]> {
  const rows = await db.select().from(schema.restaurants);
  return rows
    .filter((r) => !r.deleted)
    .map((r) => r.name)
    .sort();
}

/**
 * Dos de las tres salidas destruyen datos, así que se prueban de verdad.
 *
 * El escenario es el que importa: un móvil con su propio diario inicia sesión
 * en una cuenta que ya tiene otro. Antes de esto la app decidía sola —combinar,
 * siempre, sin decirlo—, que es una respuesta razonable pero no la única, y no
 * era de quien escribió los diarios.
 */
describe('elegir qué manda cuando los dos lados divergen', () => {
  /** Un servidor con "Ichiran" y un móvil con "Guadalupe". */
  async function diverged() {
    const server = new FakeServer();
    const cloud = makeTestDb();
    await addRestaurant(cloud.db, 'Ichiran');
    await engineFor(cloud.db, server).push();

    const device = makeTestDb();
    await addRestaurant(device.db, 'Guadalupe');

    return { server, device };
  }

  it('combinar deja los dos diarios', async () => {
    const { server, device } = await diverged();

    await applyDivergenceChoice(device.db, server.transport(), 'merge');
    await engineFor(device.db, server).sync();

    expect(await names(device.db)).toEqual(['Guadalupe', 'Ichiran']);
  });

  it('la nube manda: el diario local se va y vuelve el de la cuenta', async () => {
    const { server, device } = await diverged();

    await applyDivergenceChoice(device.db, server.transport(), 'cloud-wins');
    // Vaciar no sincroniza: deja el estado listo para que el sync haga lo suyo.
    expect(await names(device.db)).toEqual([]);

    await engineFor(device.db, server).sync();
    expect(await names(device.db)).toEqual(['Ichiran']);
  });

  it('la nube manda: se olvidan los cursores, o el diario volvería a medias', async () => {
    const { server, device } = await diverged();

    // Un pull previo deja cursores puestos. Si sobrevivieran al vaciado, el
    // siguiente pull solo traería "lo que cambió desde entonces" — o sea nada —
    // y el diario se quedaría vacío sin que nada fallara.
    await engineFor(device.db, server).pull();
    await applyDivergenceChoice(device.db, server.transport(), 'cloud-wins');
    await engineFor(device.db, server).sync();

    expect(await names(device.db)).toEqual(['Ichiran']);
  });

  it('este móvil manda: sube lo suyo y retira de la nube lo que no tiene', async () => {
    const { server, device } = await diverged();

    await applyDivergenceChoice(device.db, server.transport(), 'device-wins');
    await engineFor(device.db, server).sync();

    // Localmente solo lo suyo: "Ichiran" volvió como lápida, no como entrada.
    expect(await names(device.db)).toEqual(['Guadalupe']);

    // Y en el servidor queda registrado el borrado, no un hueco: el otro
    // dispositivo tiene que enterarse de que esa entrada se fue. Un delete a
    // secas la haría reaparecer en su siguiente push.
    const remote = server.since('restaurants', null);
    expect(remote.find((r) => r['name'] === 'Ichiran')?.deleted).toBe(true);
    expect(remote.find((r) => r['name'] === 'Guadalupe')?.deleted).toBe(false);
  });

  it('este móvil manda: reenvía también lo que ya se había subido alguna vez', async () => {
    const server = new FakeServer();
    const device = makeTestDb();
    await addRestaurant(device.db, 'Guadalupe');
    await engineFor(device.db, server).sync();

    // Ya está sincronizado, así que la bandeja de salida está vacía. Para que
    // este móvil se imponga hay que reenviarlo igualmente: el otro dispositivo
    // pudo haberlo pisado en el servidor.
    const before = await device.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));
    expect(before).toHaveLength(0);

    const outcome = await applyDivergenceChoice(device.db, server.transport(), 'device-wins');
    expect(outcome.queued).toBeGreaterThan(0);
  });
});

/**
 * Cuándo se pregunta, que es donde estaba el fallo que se vivía.
 *
 * La pregunta salía a alguien que solo ha usado la app en un teléfono, y volvía
 * a salir en cada arranque. La señal era «hay algo sin subir», que lo cumple
 * cualquiera que guarde una comida y cierre la app antes de que corra el sync.
 */
describe('cuándo se pregunta quién manda', () => {
  it('no pregunta a un móvil que ya sincronizó con esta cuenta, aunque quede algo por subir', async () => {
    const server = new FakeServer();
    const cloud = makeTestDb();
    await addRestaurant(cloud.db, 'Ichiran');
    await engineFor(cloud.db, server).push();

    const device = makeTestDb();
    await addRestaurant(device.db, 'Guadalupe');
    await engineFor(device.db, server).sync();
    await rememberAccountLinked(device.db, ACCOUNT);

    // Y ahora escribe algo y cierra la app antes de que corra el sync: la
    // bandeja tiene una entrada sin subir, que es el estado normal de cualquier
    // móvil. Antes esto bastaba para anunciar «hay dos diarios» en el siguiente
    // arranque.
    await addRestaurant(device.db, 'La Puerta Falsa');
    const pending = await device.db
      .select()
      .from(schema.changeLog)
      .where(eq(schema.changeLog.synced, false));
    expect(pending.length).toBeGreaterThan(0);

    expect(await needsDivergenceChoice(device.db, server.transport(), ACCOUNT)).toBe(false);
  });

  it('sí pregunta la primera vez que un móvil con diario entra en una cuenta con otro', async () => {
    const { server, device } = await (async () => {
      const server = new FakeServer();
      const cloud = makeTestDb();
      await addRestaurant(cloud.db, 'Ichiran');
      await engineFor(cloud.db, server).push();

      const device = makeTestDb();
      await addRestaurant(device.db, 'Guadalupe');
      return { server, device };
    })();

    expect(await needsDivergenceChoice(device.db, server.transport(), ACCOUNT)).toBe(true);
  });

  it('no pregunta a un móvil vacío: restaurar es la única respuesta posible', async () => {
    const server = new FakeServer();
    const cloud = makeTestDb();
    await addRestaurant(cloud.db, 'Ichiran');
    await engineFor(cloud.db, server).push();

    const device = makeTestDb();
    expect(await needsDivergenceChoice(device.db, server.transport(), ACCOUNT)).toBe(false);
  });

  it('no pregunta con la nube vacía: subir es la única respuesta posible', async () => {
    const server = new FakeServer();
    const device = makeTestDb();
    await addRestaurant(device.db, 'Guadalupe');

    expect(await needsDivergenceChoice(device.db, server.transport(), ACCOUNT)).toBe(false);
  });

  it('la marca es por cuenta: entrar con otra vuelve a ser un encuentro nuevo', async () => {
    const server = new FakeServer();
    const cloud = makeTestDb();
    await addRestaurant(cloud.db, 'Ichiran');
    await engineFor(cloud.db, server).push();

    const device = makeTestDb();
    await addRestaurant(device.db, 'Guadalupe');
    await rememberAccountLinked(device.db, ACCOUNT);

    const other = '22222222-2222-4222-8222-222222222222';
    expect(await needsDivergenceChoice(device.db, server.transport(), other)).toBe(true);
  });
});
