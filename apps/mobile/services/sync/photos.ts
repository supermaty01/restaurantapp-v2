import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';

import { IMAGES_DIR } from '@/lib/helpers/fs-paths';
import { imagePathToUri } from '@/lib/helpers/image-paths';
import * as schema from '@/services/db/schema';
import { recordChange, touchedAt } from '@/services/db/sync-write';
import type { AppDatabase } from '@/services/db/types';
import { getSupabase } from '@/services/supabase/client';

/**
 * Getting photos to R2.
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
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Photos per pass.
 *
 * The first sync of an imported diary has thousands to send, and pushing them
 * all in one go would hold the sync open for as long as the connection lasts —
 * with nothing saved if it drops. Each pass makes progress that survives, and
 * sync runs often enough (login, foreground, after every write) to drain the
 * backlog without anyone waiting for it.
 */
const BATCH = 15;

export interface PhotoUploadResult {
  uploaded: number;
  pending: number;
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
 * Uploads photos that have no remote key yet.
 *
 * Never throws: a photo that will not upload — deleted from the gallery,
 * unreadable, too big — must not stop the diary from syncing. It stays without
 * a key and is retried next pass, which is the right outcome for something that
 * is usually a transient network problem.
 */
export async function uploadPendingPhotos(
  db: AppDatabase,
  /** Se llama tras cada foto, para que la UI pueda decir cuánto falta. */
  onProgress?: (done: number, remaining: number) => void,
): Promise<PhotoUploadResult> {
  const result: PhotoUploadResult = { uploaded: 0, pending: 0, failed: 0, reasons: [] };

  // Distinct reasons, not one line per photo: fifteen identical 401s say the
  // same thing once.
  const seen = new Set<string>();
  const note = (reason: string) => {
    result.failed += 1;
    if (!seen.has(reason)) {
      seen.add(reason);
      result.reasons.push(reason);
    }
  };

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
    .where(and(isNull(schema.images.remoteKey), isNotNull(schema.images.path)))
    .limit(BATCH + 1);

  // One extra row is fetched purely to answer "is there more?" without a count.
  result.pending = Math.max(waiting.length - BATCH, 0);

  for (const photo of waiting.slice(0, BATCH)) {
    try {
      const uri = imagePathToUri(photo.path);
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        // The file is not where the row says it is. Names the path, because
        // "no existe" without it cannot be told apart from a wrong base
        // directory, which is the more likely of the two after an import.
        note(`fichero no encontrado (ej. ${uri})`);
        continue;
      }

      const key = keyFor(photo.uuid);
      const target = `${API_URL.replace(/\/$/, '')}/images/${encodeURIComponent(key)}`;
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
        continue;
      }

      await db
        .update(schema.images)
        .set({ remoteKey: key, ...touchedAt() })
        .where(eq(schema.images.id, photo.id));

      // So the key itself reaches the mirror; without this the photo is in R2
      // and nobody can find it.
      await recordChange(db, 'images', photo.id, photo.uuid, 'update');
      result.uploaded += 1;
      onProgress?.(result.uploaded, waiting.length - result.uploaded - result.failed);
    } catch (error) {
      // Anything the module itself refuses: an unreachable host, a URI it will
      // not read, a native method that is not there. Swallowing this is what
      // made the whole thing opaque the first time round.
      note(error instanceof Error ? error.message : String(error));
    }
  }

  return result;
}

export interface PhotoDownloadResult {
  downloaded: number;
  /** Cuántas quedan por bajar después de esta tanda. */
  pending: number;
  failed: number;
  reasons: string[];
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
  onProgress?: (done: number, remaining: number) => void,
): Promise<PhotoDownloadResult> {
  const result: PhotoDownloadResult = { downloaded: 0, pending: 0, failed: 0, reasons: [] };

  const seen = new Set<string>();
  const note = (reason: string) => {
    result.failed += 1;
    if (!seen.has(reason)) {
      seen.add(reason);
      result.reasons.push(reason);
    }
  };

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

  // Qué falta se decide mirando el disco, y por eso el filtro no puede ir en la
  // consulta. Se recorre entero pero solo se descarga un lote: comprobar si un
  // fichero existe es barato, bajarlo no.
  const missing: typeof stored = [];
  for (const photo of stored) {
    const uri = imagePathToUri(photo.path || `${photo.uuid}.jpg`);
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) missing.push(photo);
  }

  result.pending = Math.max(missing.length - BATCH, 0);

  for (const photo of missing.slice(0, BATCH)) {
    try {
      // `GET /images/:userId/:key`, no `/images/:key`. La subida va con el
      // dueño implícito en el token y el Worker lo antepone; la lectura es
      // pública a propósito (el segmento del dueño *es* la capacidad, así es
      // como funcionan las vistas previas de un enlace compartido), así que la
      // cuenta tiene que ir en la URL. Es la misma forma que usa
      // `remoteImageUri` para las fotos ajenas.
      const key = keyFor(photo.uuid);
      const source =
        `${API_URL.replace(/\/$/, '')}/images/` +
        `${encodeURIComponent(accountUuid)}/${encodeURIComponent(key)}`;
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
        continue;
      }

      // La ruta es local: se actualiza sin `recordChange`, porque no significa
      // nada en ningún otro dispositivo y mandarla solo gastaría una escritura.
      if (photo.path !== `${photo.uuid}.jpg`) {
        await db
          .update(schema.images)
          .set({ path: `${photo.uuid}.jpg` })
          .where(eq(schema.images.id, photo.id));
      }

      result.downloaded += 1;
      onProgress?.(result.downloaded, missing.length - result.downloaded - result.failed);
    } catch (error) {
      note(error instanceof Error ? error.message : String(error));
    }
  }

  return result;
}
