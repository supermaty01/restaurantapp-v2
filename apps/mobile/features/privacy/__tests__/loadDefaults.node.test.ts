import { getDefaults, resetDefaultVisibility } from '@/features/privacy/defaultsStore';
import { defaultsAreKnown, ensureDefaultsLoaded } from '@/features/privacy/loadDefaults';
import { defaultVisibilityKey } from '@/features/privacy/visibility';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import { setSetting } from '@/services/db/settings-repository';

/**
 * El fallo que estos tests vigilan no daba ningún error.
 *
 * El almacén nace en blanco —las tres a `private`— y solo lo rellenaba un hook.
 * El sync publica esos ajustes en cada pasada y la primera ocurre al arrancar,
 * así que abrir la app y no tocar nada mandaba `private/private/private` encima
 * de lo elegido: los amigos dejaban de ver el perfil entero y las visitas en las
 * que les habían etiquetado, y se «arreglaba» solo si por casualidad abrías
 * Ajustes.
 */
describe('las visibilidades por defecto, antes de publicarlas', () => {
  beforeEach(() => {
    resetDefaultVisibility();
  });

  it('sin leer el disco, nadie sabe qué comparte esta cuenta', () => {
    expect(defaultsAreKnown()).toBe(false);
  });

  it('lee del disco lo que la persona eligió, sin montar ninguna pantalla', async () => {
    const { db } = makeTestDb();
    await setSetting(db, defaultVisibilityKey('visit'), 'friends');
    await setSetting(db, defaultVisibilityKey('restaurant'), 'public');

    await ensureDefaultsLoaded(db);

    expect(getDefaults()).toEqual({ restaurant: 'public', dish: 'private', visit: 'friends' });
    expect(defaultsAreKnown()).toBe(true);
  });

  it('una clase sin preferencia guardada se queda en privado, que es el fallback seguro', async () => {
    const { db } = makeTestDb();

    await ensureDefaultsLoaded(db);

    expect(getDefaults().dish).toBe('private');
    // Y aun así se sabe: «no hay preferencia» es una respuesta, no una duda.
    expect(defaultsAreKnown()).toBe(true);
  });

  it('un valor corrupto en disco no se cuela como visibilidad', async () => {
    const { db } = makeTestDb();
    await setSetting(db, defaultVisibilityKey('visit'), 'todo-el-mundo');
    // `default` es un valor real de la columna de una entrada, pero no puede ser
    // el ajuste general: no habría contra qué resolverlo.
    await setSetting(db, defaultVisibilityKey('dish'), 'default');

    await ensureDefaultsLoaded(db);

    expect(getDefaults().visit).toBe('private');
    expect(getDefaults().dish).toBe('private');
  });

  it('no vuelve al disco una vez leído', async () => {
    const { db } = makeTestDb();
    await setSetting(db, defaultVisibilityKey('visit'), 'friends');
    await ensureDefaultsLoaded(db);

    // Se cambia el disco por debajo. La segunda llamada no debe verlo: el
    // almacén es la copia viva, y quien la cambia la actualiza al hacerlo.
    await setSetting(db, defaultVisibilityKey('visit'), 'private');
    await ensureDefaultsLoaded(db);

    expect(getDefaults().visit).toBe('friends');
  });

  it('si el disco no se puede leer, no se da por sabido — y así no se publica nada', async () => {
    const broken = {
      select: () => {
        throw new Error('base de datos ilegible');
      },
    } as never;

    await ensureDefaultsLoaded(broken);

    // La consecuencia es la que importa: `syncManager` solo publica cuando esto
    // es `true`. El servidor no distingue «no lo sé» de «no comparto», y la
    // segunda respuesta esconde el diario.
    expect(defaultsAreKnown()).toBe(false);
  });
});
