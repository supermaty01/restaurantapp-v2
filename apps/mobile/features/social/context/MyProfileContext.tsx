import { createContext, useCallback, useContext, useMemo } from 'react';

import { useAuth } from '@/lib/context/AuthContext';

import { fetchMyProfile } from '../api';
import { useAsyncResource } from '../hooks/useAsyncResource';

import type { Profile } from '../api';
import type { ReactNode } from 'react';

interface MyProfileValue {
  /** `null` sin sesión, y también mientras carga la primera vez. */
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /**
   * Refleja un cambio **ya guardado en el servidor**, sin volver a pedirlo.
   *
   * No es optimista a propósito: el perfil se guarda desde una sola pantalla y
   * el viaje es corto, así que pintar antes de saber si funcionó solo serviría
   * para tener que deshacerlo.
   */
  apply: (changes: Partial<Profile>) => void;
}

const MyProfileContext = createContext<MyProfileValue>({
  profile: null,
  loading: false,
  error: null,
  reload: async () => {},
  apply: () => {},
});

/**
 * La única copia de «mi perfil».
 *
 * Antes cada pantalla lo pedía por su cuenta con `useAsyncResource`, que carga
 * al montar y nada más, y se quedaba con su copia. De ahí salían dos fallos que
 * parecían distintos:
 *
 * - **Editar el perfil y volver no actualizaba la pestaña Perfil.**
 *   `profile-edit` termina en `router.back()`, y la pestaña —que expo-router
 *   mantiene montada— no se entera de nada: su `useEffect` depende de `load`,
 *   que solo depende de `enabled`.
 * - **La foto no salía en Inicio.** Inicio ni siquiera pedía el perfil: sacaba
 *   el nombre de `useAuth()`, que es la sesión, así que no tenía `avatarUrl`
 *   que pasarle al `Avatar` y siempre caía a las iniciales.
 *
 * El parche evidente era un `useFocusEffect` por pantalla, como hace
 * `useFriends`. Arregla el síntoma y deja el patrón puesto para la tercera
 * pantalla que quiera enseñar la foto — que además pagaría una petición cada
 * vez que se cambia de pestaña. Aquí se pide una vez por sesión y se actualiza
 * quien la cambia.
 *
 * Las amistades siguen recargando al enfocar, y está bien que sea distinto:
 * cambian **desde fuera** (alguien te acepta mientras miras otra pantalla).
 * El perfil de uno solo lo cambia uno, desde una pantalla concreta.
 */
export function MyProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const { data, loading, error, reload, setData } = useAsyncResource<Profile>(fetchMyProfile, {
    enabled: Boolean(session),
    deps: [session?.user.id],
  });

  // `useAsyncResource` no borra lo que ya cargó cuando se deshabilita, así que
  // al cerrar sesión el perfil anterior seguiría en pantalla hasta el siguiente
  // montaje. Sin sesión no hay perfil, y eso se decide aquí.
  const profile = session ? data : null;

  const apply = useCallback(
    (changes: Partial<Profile>) => {
      if (!data) return;
      setData({ ...data, ...changes });
    },
    [data, setData],
  );

  const value = useMemo<MyProfileValue>(
    () => ({ profile, loading, error, reload, apply }),
    [profile, loading, error, reload, apply],
  );

  return <MyProfileContext.Provider value={value}>{children}</MyProfileContext.Provider>;
}

export function useMyProfile(): MyProfileValue {
  return useContext(MyProfileContext);
}
