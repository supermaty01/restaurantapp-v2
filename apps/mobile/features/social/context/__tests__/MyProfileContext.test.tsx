import { act, renderHook, waitFor } from '@testing-library/react-native';

import { fetchMyProfile } from '@/features/social/api';
import type { Profile } from '@/features/social/api';
import { cacheProfile, readCachedProfile } from '@/features/social/myProfile';
import { useAuth } from '@/lib/context/AuthContext';

import { MyProfileProvider, useMyProfile } from '../MyProfileContext';

import type { ReactNode } from 'react';

/**
 * Los primeros tests de interfaz del proyecto, y conviene dejar escrita la
 * trampa que costó la primera media hora: **en `@testing-library/react-native`
 * 14 `render` y `renderHook` son asíncronos**. Sin `await`, lo que se
 * desestructura es una promesa: `result` sale `undefined` y el error que se lee
 * es «Cannot read properties of undefined», que no señala a ninguna parte.
 */
jest.mock('@/features/social/api', () => ({ fetchMyProfile: jest.fn() }));
jest.mock('@/lib/context/AuthContext', () => ({ useAuth: jest.fn() }));
// La base solo se usa para la copia en disco, que aquí se sustituye entera: lo
// que se prueba es el reparto —qué se pinta y cuándo—, no cómo se guarda. Cómo
// se guarda lo prueba `myProfile.node.test.ts`, que sí tiene un SQLite de verdad.
// El objeto es **el mismo** en cada render, como el de verdad: `useDatabase`
// memoiza sobre el handle de SQLite. Devolver uno nuevo cada vez cambiaría la
// identidad de las dependencias y el proveedor volvería a pedir el perfil en
// cada render — que es un fallo del doble, no del código.
const FAKE_DB = {};
jest.mock('@/lib/hooks/useDatabase', () => ({ useDatabase: () => FAKE_DB }));
jest.mock('@/features/social/myProfile', () => ({
  readCachedProfile: jest.fn(),
  cacheProfile: jest.fn(),
  clearCachedProfile: jest.fn(),
}));

const fetchMock = fetchMyProfile as jest.MockedFunction<typeof fetchMyProfile>;
const authMock = useAuth as jest.MockedFunction<typeof useAuth>;
const cachedMock = readCachedProfile as jest.MockedFunction<typeof readCachedProfile>;
const writeCacheMock = cacheProfile as jest.MockedFunction<typeof cacheProfile>;

const PROFILE: Profile = {
  userId: 'u-1',
  username: 'maty',
  displayName: 'Mateo',
  avatarUrl: null,
  bio: null,
};

/** Lo único que este contexto mira de una sesión: el id de quien la tiene. */
function signedIn(userId: string | null) {
  authMock.mockReturnValue({
    session: userId === null ? null : { user: { id: userId } },
  } as unknown as ReturnType<typeof useAuth>);
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <MyProfileProvider>{children}</MyProfileProvider>
);

describe('MyProfileContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue(PROFILE);
    cachedMock.mockResolvedValue(null);
    writeCacheMock.mockResolvedValue(undefined);
  });

  it('pide el perfil una sola vez, aunque lo lean varias pantallas', async () => {
    // El fallo que motivó el contexto: cada pantalla con su copia. Dos lectores
    // sobre el mismo proveedor comparten una petición y un dato.
    signedIn('u-1');

    const { result } = await renderHook(() => ({ a: useMyProfile(), b: useMyProfile() }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.a.profile).toEqual(PROFILE));
    expect(result.current.b.profile).toBe(result.current.a.profile);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('`apply` actualiza a todos los lectores sin volver a la red', async () => {
    // Es lo que arregla «editar el perfil y volver no actualiza la pestaña»: la
    // pestaña sigue montada, así que la copia compartida tiene que cambiar bajo
    // sus pies.
    signedIn('u-1');

    const { result } = await renderHook(
      () => ({ writer: useMyProfile(), reader: useMyProfile() }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.reader.profile).toEqual(PROFILE));

    await act(async () => {
      result.current.writer.apply({ displayName: 'Mateo Álvarez' });
    });

    expect(result.current.reader.profile?.displayName).toBe('Mateo Álvarez');
    // Y el resto sigue ahí: `apply` es una fusión, no un reemplazo.
    expect(result.current.reader.profile?.username).toBe('maty');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sin sesión no hay perfil, ni petición', async () => {
    signedIn(null);

    const { result } = await renderHook(() => useMyProfile(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('al cerrar sesión el perfil desaparece de inmediato', async () => {
    // `useAsyncResource` conserva lo último que cargó cuando se deshabilita, así
    // que sin la decisión explícita del proveedor la foto y el nombre de la
    // cuenta anterior seguirían en pantalla después de salir.
    signedIn('u-1');
    const { result, rerender } = await renderHook(() => useMyProfile(), { wrapper });
    await waitFor(() => expect(result.current.profile).toEqual(PROFILE));

    signedIn(null);
    await rerender({});

    expect(result.current.profile).toBeNull();
  });

  it('el primer fotograma sale de la copia en disco, sin esperar a la red', async () => {
    /*
     * Lo que se veía: al abrir la app, el avatar de Inicio pasaba por tres
     * estados en menos de un segundo —círculo vacío, iniciales del correo,
     * foto—, porque el perfil solo existía cuando contestaba la red.
     */
    signedIn('u-1');
    const cached: Profile = { ...PROFILE, displayName: 'Mateo (de disco)' };
    cachedMock.mockResolvedValue(cached);

    // La red tarda: es el hueco que antes se pintaba con las iniciales.
    let answer: (profile: Profile) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Profile>((resolve) => {
        answer = resolve;
      }),
    );

    const { result } = await renderHook(() => useMyProfile(), { wrapper });

    await waitFor(() => expect(result.current.profile).toEqual(cached));

    await act(async () => {
      answer(PROFILE);
    });
    await waitFor(() => expect(result.current.profile?.displayName).toBe('Mateo'));
  });

  it('lo que llega de la red se guarda para el próximo arranque', async () => {
    signedIn('u-1');

    const { result } = await renderHook(() => useMyProfile(), { wrapper });
    await waitFor(() => expect(result.current.profile).toEqual(PROFILE));

    expect(writeCacheMock).toHaveBeenCalledWith(expect.anything(), PROFILE);
  });
});
