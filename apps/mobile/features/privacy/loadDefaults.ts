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
 * Lee del disco las visibilidades por defecto, si no se han leído ya.
 *
 * ## Qué se veía roto
 *
 * `defaultsStore` nace en blanco —las tres a `private`, que es el fallback
 * seguro para *pintar*— y hasta ahora solo lo rellenaba `useDefaultVisibility`,
 * que es un hook: se ejecuta al montar un formulario o la pantalla de Ajustes, y
 * no antes.
 *
 * El sync, en cambio, publica esos ajustes en **cada pasada** (`syncManager`), y
 * la primera pasada ocurre al arrancar la app. Así que abrir la app y no tocar
 * nada mandaba `private/private/private` encima de lo que la persona tenía
 * elegido: desde ese momento sus amigos dejaban de ver **todo** lo guardado como
 * `default` —el perfil entero, las visitas en las que te había etiquetado— hasta
 * que por casualidad abriera Ajustes y el valor real volviera a subir.
 *
 * Lo que lo hacía indistinguible de un fallo de red es que no falla nada: el
 * dato se pierde en el servidor, y quien lo mira desde otra cuenta ve un diario
 * vacío. Por eso el cargador vive fuera de React y el sync lo espera.
 *
 * Es idempotente y barato: en cuanto las tres están leídas no toca el disco.
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
      // Que una preferencia no se pueda leer no puede dejar un formulario sin
      // abrirse; se reintenta en la siguiente llamada.
      unmarkLoaded(entity);
    }
  }

  if (Object.keys(read).length > 0) setDefaults({ ...getDefaults(), ...read });
}

/**
 * ¿Se sabe ya qué comparte esta cuenta?
 *
 * El sync lo pregunta antes de publicar. Subir el valor en blanco es peor que no
 * subir nada: el servidor no distingue «todavía no lo sé» de «no comparto», y la
 * segunda respuesta esconde el diario entero. Ante la duda, no se toca lo que ya
 * hay puesto allí.
 */
export function defaultsAreKnown(): boolean {
  return SHAREABLE_ENTITIES.every((entity) => isLoaded(entity));
}
