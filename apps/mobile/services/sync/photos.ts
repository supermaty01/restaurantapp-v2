import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';

import { IMAGES_DIR } from '@/lib/helpers/fs-paths';
import { normalizeImagePath } from '@/lib/helpers/image-paths';
import * as schema from '@/services/db/schema';
import { recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';
import { getSupabase } from '@/services/supabase/client';
import { mapWithLimit } from '@/services/sync/pool';

/**
 * Getting photos to R2 y de vuelta.
 *
 * They were the missing half of sharing. The mirror carried `remote_key` from
 * the first migration, the Worker has served `/images/:user/:key` all along,
 * and nothing on the device ever wrote a key — so every shared visit reached
 * its reader as a placeholder. Not a permissions problem: the photos were
 * simply never uploaded.
 *
 * Deliberately not part of `SyncEngine`. Rows are small, ordered and
 * transactional-ish; photos are none of those. One is megabytes, any one of
 * them can fail on its own without meaning anything about the rest, and a
 * diary imported from v1 has thousands waiting. Mixing them would make a failed
 * upload look like a failed sync.
 *
 * ## Por qué ya no hay tandas
 *
 * Había un tope de quince por pasada, con la idea de que cada tanda dejara algo
 * hecho aunque se cortara la conexión. Lo que hacía de verdad era **parar**: al
 * terminar la tanda el sync se daba por bueno y las 985 fotos restantes se
 * quedaban esperando a que algo lo volviera a disparar. Restaurar un diario en
 * un móvil limpio se convertía en abrir la app sesenta veces.
 *
 * El argumento de "que sobreviva lo hecho" nunca dependió del tope: cada foto se
 * confirma en su propia escritura (la clave remota al subir, el fichero en disco
 * al bajar), así que cortar a la mitad conserva la mitad igual. El tope solo
 * decidía cuándo dejar de intentarlo. Ahora se sigue hasta el final, y lo que
 * queda por hacer se cuenta en la barra de progreso, no en pasadas.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Cuántas fotos van en vuelo a la vez.
 *
 * Una transferencia es casi toda espera, así que de una en una el tiempo total
 * es la suma de las latencias y no del ancho de banda — con mil fotos, la
 * diferencia entre media hora y unos minutos. Seis y no sesenta porque pasado
 * cierto punto el cuello de botella deja de ser la espera y empieza a ser el
 * móvil: cada subida en vuelo mantiene un fichero abierto y su buffer.
 */
const CONCURRENCY = 6;

/** Cada cuántas fotos se avisa a la UI. */
const PROGRESS_EVERY = 1;

export type PhotoPhase = 'upload' | 'download';

/**
 * Lo que la UI necesita para decir qué está pasando.
 *
 * `phase` no es un adorno: la pantalla decía "Subiendo fotos" durante la bajada
 * porque subir y bajar compartían el mismo reporte y la etiqueta estaba escrita
 * a mano en la tarjeta de perfil. Con la fase en el dato, la frase no puede
 * volver a mentir.
 */
export interface PhotoProgress {
  phase: PhotoPhase;
  /** Cuántas se han resuelto (con éxito o no) de esta fase. */
  done: number;
  /** Cuántas tenía esta fase al empezar. */
  total: number;
}

export interface PhotoTransferResult {
  /** Subidas o bajadas, según la fase. */
  moved: number;
  failed: number;
  /**
   * Why they failed, one entry per distinct reason.
   *
   * The first version of this counted failures and threw the reasons away, so
   * "15 sin poder subir" was all anyone got — the same number whether the files
   * were missing, the Worker was refusing, or the endpoint did not exist. A
   * count that cannot be acted on is not diagnostics, and finding out took a
   * round trip through the person running the app.
   */
  reasons: string[];
}

/** The key a photo gets in R2. Its uuid, so it is stable across devices. */
function keyFor(uuid: string): string {
  return uuid;
}

async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Los nombres de fichero que hay ahora mismo en el directorio de imágenes.
 *
 * Una sola llamada nativa en vez de una por foto. Antes cada pasada preguntaba
 * `getInfoAsync` por cada fila con clave remota **antes de bajar nada**: con mil
 * fotos son mil saltos al hilo nativo cada vez que se sincroniza, y ese barrido
 * se pagaba entero aunque no hubiera nada que bajar.
 */
async function filesOnDisk(): Promise<Set<string>> {
  try {
    const names = await FileSystem.readDirectoryAsync(IMAGES_DIR);
    return new Set(names);
  } catch {
    // El directorio no existe todavía: no hay ningún fichero, que es una
    // respuesta perfectamente válida y no un error.
    return new Set();
  }
}

/** El nombre de fichero dentro de `images/`, o null si la ruta apunta fuera. */
function localFilename(path: string | null): string | null {
  if (!path) return null;
  const normalized = normalizeImagePath(path);
  if (!normalized.startsWith(IMAGES_DIR)) return null;
  return normalized.slice(IMAGES_DIR.length) || null;
}

/** Reúne motivos distintos, no uno por foto: quince 401 idénticos dicen lo mismo una vez. */
function reasonCollector(result: PhotoTransferResult) {
  const seen = new Set<string>();
  return (reason: string) => {
    result.failed += 1;
    if (!seen.has(reason)) {
      seen.add(reason);
      result.reasons.push(reason);
    }
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sube todas las fotos que no tienen clave remota todavía.
 *
 * Nunca lanza: una foto que no sube — borrada de la galería, ilegible, enorme —
 * no puede impedir que el diario se sincronice. Se queda sin clave y se
 * reintenta en la siguiente pasada, que es lo correcto para lo que casi siempre
 * es un corte de red pasajero.
 */
export async function uploadPendingPhotos(
  db: AppDatabase,
  /** Se llama según avanza, para que la UI pueda decir cuánto falta. */
  onProgress?: (progress: PhotoProgress) => void,
): Promise<PhotoTransferResult> {
  const result: PhotoTransferResult = { moved: 0, failed: 0, reasons: [] };
  const note = reasonCollector(result);

  if (!API_URL) {
    result.reasons.push('EXPO_PUBLIC_API_URL no está definida: no hay a dónde subir');
    return result;
  }

  const token = await accessToken();
  if (!token) {
    result.reasons.push('sin sesión de Supabase: no hay con qué autenticarse');
    return result;
  }

  const waiting = await db
    .select({ id: schema.images.id, uuid: schema.images.uuid, path: schema.images.path })
    .from(schema.images)
    // La tabla de imágenes local no tiene borrado suave: una foto quitada de
    // una entrada se borra de verdad, porque el fichero también se va.
    .where(and(isNull(schema.images.remoteKey), isNotNull(schema.images.path)));

  if (waiting.length === 0) return result;

  const onDisk = await filesOnDisk();
  const base = API_URL.replace(/\/$/, '');

  let done = 0;
  const advance = () => {
    done += 1;
    if (done % PROGRESS_EVERY === 0 || done === waiting.length) {
      onProgress?.({ phase: 'upload', done, total: waiting.length });
    }
  };

  await mapWithLimit(waiting, CONCURRENCY, async (photo) => {
    try {
      const filename = localFilename(photo.path);
      const uri = filename ? `${IMAGES_DIR}${filename}` : normalizeImagePath(photo.path ?? '');

      // Existir se comprueba contra el listado, no con una llamada por foto. Si
      // la ruta apunta fuera de `images/` (un caso heredado) se pregunta, que es
      // lo raro y no el caso común.
      const present = filename ? onDisk.has(filename) : (await FileSystem.getInfoAsync(uri)).exists;
      if (!present) {
        // The file is not where the row says it is. Names the path, because
        // "no existe" without it cannot be told apart from a wrong base
        // directory, which is the more likely of the two after an import.
        note(`fichero no encontrado (ej. ${uri})`);
        return;
      }

      const key = keyFor(photo.uuid);
      const target = `${base}/images/${encodeURIComponent(key)}`;
      const upload = await FileSystem.uploadAsync(target, uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'image/jpeg',
        },
      });

      if (upload.status < 200 || upload.status >= 300) {
        // The body is where a Worker says what it disliked; 401 with no body
        // is itself the answer (auth), and a 404 means the route is not there.
        const body = (upload.body ?? '').slice(0, 200);
        note(`HTTP ${upload.status}${body ? ` — ${body}` : ''} en ${target}`);
        return;
      }

      await db
        .update(schema.images)
        .set({ remoteKey: key, ...touchedAt() })
        .where(eq(schema.images.id, photo.id));

      // So the key itself reaches the mirror; without this the photo is in R2
      // and nobody can find it.
      await recordChange(db, 'images', photo.id, photo.uuid, 'update');
      result.moved += 1;
    } catch (error) {
      // Anything the module itself refuses: an unreachable host, a URI it will
      // not read, a native method that is not there. Swallowing this is what
      // made the whole thing opaque the first time round.
      note(describe(error));
    } finally {
      advance();
    }
  });

  return result;
}

/**
 * Trae de vuelta las fotos que están en R2 y no en este teléfono.
 *
 * La mitad que faltaba. `remote_key` viajaba desde la primera migración y el
 * Worker sirve `/images/:key` desde siempre, pero **no había una sola línea que
 * descargara nada**: `imagePathToUri()` resuelve siempre a un `file://` local y
 * no cae de vuelta a la clave remota. O sea que restaurar en un móvil nuevo
 * devolvía el diario entero con todas las fotos rotas — justo el caso que una
 * copia de seguridad existe para cubrir.
 *
 * Qué falta por bajar se deduce del disco, no de una columna: una fila con
 * `remote_key` cuyo fichero no está. Así no hay estado que mantener al día ni
 * que pueda quedarse mintiendo, y borrar la caché del móvil se repara solo en la
 * siguiente pasada.
 *
 * Nunca lanza, igual que la subida: una foto que no baja no puede convertir una
 * sincronización correcta en un error.
 */
export async function downloadMissingPhotos(
  db: AppDatabase,
  /** El dueño de las fotos: la clave en R2 es `${cuenta}/${uuid}`. */
  accountUuid: string,
  onProgress?: (progress: PhotoProgress) => void,
): Promise<PhotoTransferResult> {
  const result: PhotoTransferResult = { moved: 0, failed: 0, reasons: [] };
  const note = reasonCollector(result);

  if (!API_URL) {
    result.reasons.push('EXPO_PUBLIC_API_URL no está definida: no hay de dónde bajar');
    return result;
  }

  const token = await accessToken();
  if (!token) {
    result.reasons.push('sin sesión de Supabase: no hay con qué autenticarse');
    return result;
  }

  await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true }).catch(() => {
    // Ya existía. `intermediates` no lo garantiza en todas las plataformas y
    // fallar aquí impediría bajar nada.
  });

  const stored = await db
    .select({ id: schema.images.id, uuid: schema.images.uuid, path: schema.images.path })
    .from(schema.images)
    .where(and(isNotNull(schema.images.remoteKey), ne(schema.images.remoteKey, '')));

  if (stored.length === 0) return result;

  // Qué falta se decide mirando el disco, y por eso el filtro no puede ir en la
  // consulta. Un único listado del directorio responde por todas las filas.
  const onDisk = await filesOnDisk();
  const missing = stored.filter((photo) => {
    const filename = localFilename(photo.path) ?? `${photo.uuid}.jpg`;
    return !onDisk.has(filename);
  });

  if (missing.length === 0) return result;

  const base = API_URL.replace(/\/$/, '');
  let done = 0;
  const advance = () => {
    done += 1;
    if (done % PROGRESS_EVERY === 0 || done === missing.length) {
      onProgress?.({ phase: 'download', done, total: missing.length });
    }
  };

  await mapWithLimit(missing, CONCURRENCY, async (photo) => {
    try {
      // `GET /images/:userId/:key`, no `/images/:key`. La subida va con el
      // dueño implícito en el token y el Worker lo antepone; la lectura es
      // pública a propósito (el segmento del dueño *es* la capacidad, así es
      // como funcionan las vistas previas de un enlace compartido), así que la
      // cuenta tiene que ir en la URL. Es la misma forma que usa
      // `remoteImageUri` para las fotos ajenas.
      const key = keyFor(photo.uuid);
      const source = `${base}/images/${encodeURIComponent(accountUuid)}/${encodeURIComponent(key)}`;
      // El destino se deriva del uuid, no de lo que diga la fila: una ruta
      // heredada de otro dispositivo, o de una instalación anterior, apunta a un
      // sitio que aquí no existe.
      const target = `${IMAGES_DIR}${photo.uuid}.jpg`;

      const download = await FileSystem.downloadAsync(source, target, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (download.status < 200 || download.status >= 300) {
        // `downloadAsync` escribe el cuerpo del error como si fuera la imagen:
        // sin esto quedaría un fichero de 30 bytes que la app trata como una
        // foto y que nunca se reintenta, porque "existe".
        await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
        note(`HTTP ${download.status} en ${source}`);
        return;
      }

      // La ruta es local: se actualiza sin `recordChange`, porque no significa
      // nada en ningún otro dispositivo y mandarla solo gastaría una escritura.
      if (photo.path !== `${photo.uuid}.jpg`) {
        await db
          .update(schema.images)
          .set({ path: `${photo.uuid}.jpg` })
          .where(eq(schema.images.id, photo.id));
      }

      result.moved += 1;
    } catch (error) {
      note(describe(error));
    } finally {
      advance();
    }
  });

  return result;
}
