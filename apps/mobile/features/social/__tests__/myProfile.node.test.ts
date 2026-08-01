import type { Profile } from '@/features/social/api';
import { cacheProfile, clearCachedProfile, readCachedProfile } from '@/features/social/myProfile';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import { setSetting } from '@/services/db/settings-repository';

const MINE: Profile = {
  userId: 'u-1',
  username: 'maty',
  displayName: 'Mateo',
  avatarUrl: 'https://example.test/images/u-1/avatar-1',
  bio: 'Como mucho arroz',
};

describe('la copia en disco de «mi perfil»', () => {
  it('va y vuelve entera', async () => {
    const { db } = makeTestDb();
    await cacheProfile(db, MINE);

    expect(await readCachedProfile(db, 'u-1')).toEqual(MINE);
  });

  it('no se usa la de otra cuenta', async () => {
    /*
     * Vive en `app_settings`, que entra en la copia de seguridad. Restaurar el
     * diario de alguien en otro móvil traería su perfil con él, y durante un
     * instante se vería su nombre con otra sesión abierta.
     */
    const { db } = makeTestDb();
    await cacheProfile(db, MINE);

    expect(await readCachedProfile(db, 'otra-cuenta')).toBeNull();
  });

  it('un valor con otra forma no se cuela como perfil', async () => {
    // Lo pudo escribir una versión anterior de la app. `JSON.parse(x) as T` no
    // comprueba nada, afirma (AGENTS §3.2).
    const { db } = makeTestDb();
    await setSetting(db, 'my_profile_cache', '{"userId":"u-1"}');

    expect(await readCachedProfile(db, 'u-1')).toBeNull();
  });

  it('un valor que no es JSON tampoco rompe nada', async () => {
    const { db } = makeTestDb();
    await setSetting(db, 'my_profile_cache', 'esto no es json');

    expect(await readCachedProfile(db, 'u-1')).toBeNull();
  });

  it('cerrar sesión la retira', async () => {
    const { db } = makeTestDb();
    await cacheProfile(db, MINE);
    await clearCachedProfile(db);

    expect(await readCachedProfile(db, 'u-1')).toBeNull();
  });

  it('no lanza cuando la base no está disponible', async () => {
    // Es una optimización de pintado: su peor caso tiene que ser volver a ver el
    // desfile de avatares, nunca una pantalla que no arranca.
    const broken = {
      select: () => {
        throw new Error('base ilegible');
      },
      insert: () => {
        throw new Error('base ilegible');
      },
    } as never;

    await expect(readCachedProfile(broken, 'u-1')).resolves.toBeNull();
    await expect(cacheProfile(broken, MINE)).resolves.toBeUndefined();
  });
});
