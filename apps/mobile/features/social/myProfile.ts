import { getSetting, setSetting } from '@/services/db/settings-repository';
import type { AppDatabase } from '@/services/db/types';

import type { Profile } from './api';

/**
 * La última copia conocida de «mi perfil», guardada entre arranques.
 *
 * ## Qué se veía
 *
 * Al abrir la app, el avatar de Inicio pasaba por tres estados en menos de un
 * segundo: un círculo de color vacío, luego las iniciales del correo, y por
 * último la foto. Tres cosas distintas donde debería haber una, y ninguna era un
 * fallo aislado — era el orden natural en que llega cada dato:
 *
 * 1. sin sesión recuperada todavía, el nombre es `'Tú'`;
 * 2. la sesión llega y trae un correo, así que salen sus iniciales;
 * 3. el perfil llega de la red y trae la foto.
 *
 * Con la copia guardada, el paso 3 ya está resuelto antes de empezar: el nombre
 * y la URL de la foto salen del disco, y `expo-image` sirve la imagen de su
 * caché. La red sigue consultándose y actualiza lo que haya cambiado, pero deja
 * de decidir el primer fotograma.
 *
 * ## Por qué lleva el `userId` dentro
 *
 * Vive en `app_settings`, que entra en la copia de seguridad. Restaurar el
 * diario de alguien en otro móvil traería su perfil con él, y durante un
 * instante se vería su nombre con otra sesión abierta. Se guarda con el uuid de
 * su dueño y solo se usa si coincide con quien ha iniciado sesión.
 */
const KEY = 'my_profile_cache';

interface CachedProfile extends Profile {
  userId: string;
}

function isProfile(value: unknown): value is CachedProfile {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row['userId'] === 'string' && typeof row['username'] === 'string';
}

/** La copia guardada, si es de esta cuenta. Nunca lanza: es una optimización. */
export async function readCachedProfile(db: AppDatabase, userId: string): Promise<Profile | null> {
  try {
    const stored = await getSetting(db, KEY);
    if (!stored) return null;

    // `unknown` y comprobación, nunca `as`: esto sale de disco y pudo escribirlo
    // una versión anterior de la app con otra forma (AGENTS §3.2).
    const parsed: unknown = JSON.parse(stored);
    if (!isProfile(parsed) || parsed.userId !== userId) return null;

    return {
      userId: parsed.userId,
      username: parsed.username,
      displayName: parsed.displayName ?? null,
      avatarUrl: parsed.avatarUrl ?? null,
      bio: parsed.bio ?? null,
    };
  } catch {
    return null;
  }
}

/** Guarda la copia. Nunca lanza: que no se pueda guardar no rompe nada hoy. */
export async function cacheProfile(db: AppDatabase, profile: Profile): Promise<void> {
  try {
    await setSetting(db, KEY, JSON.stringify(profile));
  } catch {
    // El único coste es volver a ver el desfile de avatares en el próximo
    // arranque, y eso no justifica romper una pantalla.
  }
}

/** Al cerrar sesión: la copia es de quien ya no está. */
export async function clearCachedProfile(db: AppDatabase): Promise<void> {
  try {
    await setSetting(db, KEY, '');
  } catch {
    // Ver arriba. Y aunque quede, `readCachedProfile` la descarta en cuanto el
    // uuid no coincida con la sesión.
  }
}
