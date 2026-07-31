import { getSetting } from '@/services/db/settings-repository';
import type { AppDatabase } from '@/services/db/types';

import { getDefaults, isLoaded, markLoaded, setDefaults, unmarkLoaded } from './defaultsStore';
import {
  defaultVisibilityKey,
  isExplicit,
  isVisibility,
  SHAREABLE_ENTITIES,
  type ExplicitVisibility,
  type ShareableEntity,
} from './visibility';

/**
 * Lee del disco los ajustes de visibilidad por defecto, si no se han leído ya.
 *
 * Existe porque `defaultsStore` nace en blanco —todo privado— y hasta ahora solo
 * lo rellenaba `useDefaultVisibility`, que es un hook y por tanto solo corre
 * cuando alguien monta un formulario o la pantalla de ajustes.
 *
 * El sync, en cambio, publica esos ajustes en **cada pasada**, y la primera
 * pasada ocurre al arrancar la app. Así que abrir la app y no tocar nada
 * publicaba `private/private/private` encima de lo que el usuario tenía
 * elegido: a partir de ese momento sus amigos dejaban de ver todo lo guardado
 * como `default`, en su perfil y en el feed, hasta que por casualidad abriera
 * Ajustes y el valor real volviera a subir.
 *
 * No es un fallo de pintado sino de datos: lo que se pierde es la configuración
 * en el servidor, y quien la mira desde otra cuenta ve un diario vacío sin que
 * nada falle. Por eso el cargador vive fuera de React y el sync lo espera antes
 * de publicar nada.
 */
export async function ensureDefaultsLoaded(db: AppDatabase): Promise<void> {
  const pending = SHAREABLE_ENTITIES.filter((entity) => !isLoaded(entity));
  if (pending.length === 0) return;

  const read: Partial<Record<ShareableEntity, ExplicitVisibility>> = {};

  for (const entity of pending) {
    markLoaded(entity);
    try {
      const stored = await getSetting(db, defaultVisibilityKey(entity));
      if (stored && isVisibility(stored) && isExplicit(stored)) read[entity] = stored;
    } catch {
      // Que una preferencia no se pueda leer no puede dejar la app sin arrancar;
      // se reintenta en la siguiente pasada.
      unmarkLoaded(entity);
    }
  }

  if (Object.keys(read).length > 0) setDefaults({ ...getDefaults(), ...read });
}

/**
 * ¿Se sabe ya qué comparte esta cuenta?
 *
 * El sync lo pregunta antes de publicar: subir el valor en blanco es peor que
 * no subir nada, porque el servidor no distingue "todavía no lo sé" de "no
 * comparto nada" y la segunda respuesta esconde el diario entero.
 */
export function defaultsAreKnown(): boolean {
  return SHAREABLE_ENTITIES.every((entity) => isLoaded(entity));
}
