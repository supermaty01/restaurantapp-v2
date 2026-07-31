import { useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/lib/context/AuthContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { getSetting, setSetting } from '@/services/db/settings-repository';
import type { AppDatabase } from '@/services/db/types';

import { fetchMyProfile, type Profile } from './api';

/**
 * Tu perfil, sin el desfile de avatares.
 *
 * Inicio y Perfil pintaban la foto de quien está usando la app, y cada pantalla
 * la pedía por su cuenta al arrancar. Entre que llegaba, se veían tres cosas
 * distintas en el mismo sitio: un hueco, después las iniciales del correo (con
 * su color derivado del correo), después las iniciales del nombre (con otro
 * color) y por fin la foto. Cuatro fotogramas para un dato que no cambia casi
 * nunca.
 *
 * Así que se guarda. En `app_settings`, como el resto de preferencias, para que
 * el **primer** fotograma tras un arranque en frío ya sea el bueno; y en un
 * almacén de módulo para que las dos pantallas compartan la misma copia en vez
 * de tener una cada una.
 *
 * La red sigue mandando: se pide igual y lo que vuelva reemplaza a lo guardado.
 * Lo que cambia es que mientras tanto se enseña lo último que se supo, que es
 * casi siempre lo correcto.
 */

const CACHE_KEY = 'myProfile';

let profile: Profile | null = null;
/** Falso hasta que se sabe algo: ni perfil ni "no hay perfil". */
let known = false;
let loading = false;
const listeners = new Set<() => void>();

interface Snapshot {
  profile: Profile | null;
  /** `false` mientras no se sepa si hay foto: es lo que evita el parpadeo. */
  known: boolean;
}

let snapshot: Snapshot = { profile: null, known: false };

function publish() {
  snapshot = { profile, known };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function parse(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Profile>;
    if (typeof value.userId !== 'string' || typeof value.username !== 'string') return null;
    return {
      userId: value.userId,
      username: value.username,
      displayName: value.displayName ?? null,
      avatarUrl: value.avatarUrl ?? null,
      bio: value.bio ?? null,
    };
  } catch {
    return null;
  }
}

/** Lo pone la pantalla de editar perfil, para no esperar a la siguiente lectura. */
export function setMyProfile(next: Profile | null, db?: AppDatabase): void {
  profile = next;
  known = true;
  publish();
  if (db) {
    void setSetting(db, CACHE_KEY, JSON.stringify(next)).catch(() => {
      // La caché es un adelanto, no la verdad: si no se guarda, la próxima vez
      // se pide a la red como siempre.
    });
  }
}

/** Test-only: olvida lo aprendido entre casos. */
export function resetMyProfile(): void {
  profile = null;
  known = false;
  loading = false;
  publish();
}

/**
 * El perfil de quien usa la app.
 *
 * `known` es la mitad importante: hasta que no vale `true` no se sabe si hay
 * foto, y quien pinta un avatar tiene que enseñar un hueco tranquilo en vez de
 * unas iniciales que van a durar medio segundo.
 */
export function useMyProfile(): Snapshot {
  const db = useDatabase();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!userId) {
      // Sin sesión no hay perfil, y eso se sabe sin preguntar a nadie.
      profile = null;
      known = true;
      publish();
      return;
    }

    let cancelled = false;

    void (async () => {
      // Primero lo guardado, para que el primer fotograma ya sea el bueno.
      if (!known) {
        const cached = parse(await getSetting(db, CACHE_KEY));
        if (!cancelled && cached && cached.userId === userId && !known) {
          profile = cached;
          known = true;
          publish();
        }
      }

      if (loading) return;
      loading = true;
      try {
        const fresh = await fetchMyProfile();
        if (cancelled) return;
        setMyProfile(fresh, db);
      } catch {
        // Sin red se sigue enseñando lo guardado. Si tampoco había nada, se
        // sabe que no hay foto y el avatar cae a las iniciales, una sola vez.
        if (!cancelled && !known) {
          known = true;
          publish();
        }
      } finally {
        loading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  return state;
}
