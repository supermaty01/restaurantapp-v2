/**
 * Los tipos del formato `.restoshare`.
 *
 * El formato en sí ya no se define aquí: vive en `@restaurantapp/shared` como
 * esquema zod, porque lo escriben y lo leen dos procesos distintos —la app y el
 * Worker, que guarda el mismo payload como contenido de un enlace compartido— y
 * un formato definido dos veces es un formato que acaba divergiendo.
 *
 * Se reexporta desde aquí para que el resto de la app siga pidiéndole el tipo a
 * `services/share`, que es donde corresponde preguntarlo, y no a un paquete del
 * monorepo.
 *
 * Lo que sigue siendo propio de este fichero es lo que solo existe durante una
 * importación: conflictos y resultados. Nada de eso viaja dentro del fichero.
 */

export type {
  ShareEntityType,
  ShareableTag,
  ShareableImage,
  ShareableRestaurant,
  ShareableDish,
  ShareableVisit,
  ShareFileData,
} from '@restaurantapp/shared';

export {
  CURRENT_SHARE_VERSION,
  SHARE_FILE_EXTENSION,
  SHARE_FILE_MIME_TYPE,
} from '@restaurantapp/shared';

import type { ShareEntityType } from '@restaurantapp/shared';

/** Un nombre que ya existe en el diario, detectado antes de importar. */
export interface ConflictResult {
  hasConflict: boolean;
  existingEntity?:
    | {
        id: number;
        name: string;
      }
    | undefined;
  incomingName: string;
}

/** Qué hacer con él: reutilizar lo que hay o crear una entrada aparte. */
export type ConflictResolution =
  { type: 'use_existing'; existingId: number } | { type: 'create_new' };

export interface ImportResult {
  success: boolean;
  entityType: ShareEntityType;
  entityId?: number | undefined;
  entityName?: string | undefined;
  error?: string | undefined;
}
