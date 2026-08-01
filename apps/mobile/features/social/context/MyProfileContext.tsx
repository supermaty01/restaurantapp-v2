import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/lib/context/AuthContext';
import { useDatabase } from '@/lib/hooks/useDatabase';

import { fetchMyProfile } from '../api';
import { cacheProfile, clearCachedProfile, readCachedProfile } from '../myProfile';

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
 *
 * ## Y por qué se guarda en disco
 *
 * Porque la red decide *cuándo* llega, y el avatar de Inicio se pintaba tres
 * veces mientras tanto: círculo vacío, iniciales del correo, foto. La copia en
 * `app_settings` hace que el primer fotograma ya sea el bueno; la petición sigue
 * saliendo y corrige lo que haya cambiado. El razonamiento entero, en
 * `myProfile.ts`.
 */
export function MyProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const db = useDatabase();
  const userId = session?.user.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const fresh = await fetchMyProfile();
      if (!mounted.current) return;
      setProfile(fresh);
      setError(null);
      await cacheProfile(db, fresh);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [db, userId]);

  useEffect(() => {
    if (!userId) {
      // Sin sesión no hay perfil, y hay que decirlo aquí: dejar el anterior
      // puesto haría que cerrar sesión siguiera enseñando tu cara.
      setProfile(null);
      setError(null);
      void clearCachedProfile(db);
      return;
    }

    let cancelled = false;
    void (async () => {
      // Primero el disco, y sin esperar a la red: es lo que hace que el primer
      // fotograma sea la foto y no un hueco. Si la petición ya contestó —al
      // volver de segundo plano, por ejemplo—, no se pisa lo nuevo con lo viejo.
      const cached = await readCachedProfile(db, userId);
      if (!cancelled && cached) setProfile((current) => current ?? cached);
      if (!cancelled) await load();
    })();

    return () => {
      cancelled = true;
    };
  }, [db, userId, load]);

  const apply = useCallback(
    (changes: Partial<Profile>) => {
      setProfile((current) => {
        if (!current) return current;
        const next = { ...current, ...changes };
        void cacheProfile(db, next);
        return next;
      });
    },
    [db],
  );

  const value = useMemo<MyProfileValue>(
    () => ({ profile, loading, error, reload: load, apply }),
    [profile, loading, error, load, apply],
  );

  return <MyProfileContext.Provider value={value}>{children}</MyProfileContext.Provider>;
}

export function useMyProfile(): MyProfileValue {
  return useContext(MyProfileContext);
}
