import { makeTestDb } from '@/services/db/__tests__/test-db';
import { setSetting } from '@/services/db/settings-repository';

import { getDefaults, resetDefaultVisibility } from './defaultsStore';
import { defaultsAreKnown, ensureDefaultsLoaded } from './loadDefaults';
import { defaultVisibilityKey } from './visibility';

describe('los ajustes de visibilidad, antes de publicarlos', () => {
  beforeEach(() => {
    resetDefaultVisibility();
  });

  it('se leen del disco los tres, no solo el que alguien esté mirando', async () => {
    const { db } = makeTestDb();
    await setSetting(db, defaultVisibilityKey('visit'), 'friends');
    await setSetting(db, defaultVisibilityKey('restaurant'), 'public');

    await ensureDefaultsLoaded(db);

    expect(getDefaults()).toEqual({ restaurant: 'public', dish: 'private', visit: 'friends' });
  });

  /**
   * El fallo que esto cubre: el almacén nace en blanco y el sync lo publicaba
   * tal cual en la primera pasada, así que abrir la app dejaba la cuenta como
   * "no comparto nada" y los amigos veían un diario vacío.
   */
  it('no dice saberlos hasta haberlos leído', async () => {
    const { db } = makeTestDb();
    expect(defaultsAreKnown()).toBe(false);

    await ensureDefaultsLoaded(db);
    expect(defaultsAreKnown()).toBe(true);
  });

  it('un ajuste sin guardar se queda en privado, no en indefinido', async () => {
    const { db } = makeTestDb();
    await ensureDefaultsLoaded(db);

    expect(getDefaults().dish).toBe('private');
  });

  it('no vuelve a leer lo que ya leyó', async () => {
    const { db } = makeTestDb();
    await ensureDefaultsLoaded(db);

    // Un cambio hecho por detrás no debe reaparecer: a partir de aquí manda la
    // copia en memoria, que es la que edita el usuario.
    await setSetting(db, defaultVisibilityKey('visit'), 'public');
    await ensureDefaultsLoaded(db);

    expect(getDefaults().visit).toBe('private');
  });
});
