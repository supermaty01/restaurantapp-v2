import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';

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
export async function uploadPendingPhotos(db: AppDatabase): Promise<PhotoUploadResult> {
  const result: PhotoUploadResult = { uploaded: 0, pending: 0, failed: 0 };
  if (!API_URL) return result;

  const token = await accessToken();
  if (!token) return result;

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
        // The file is gone from the device. Nothing to upload and nothing to
        // fix; leaving the row keyless means it is skipped, not retried
        // forever with the same result.
        result.failed += 1;
        continue;
      }

      const key = keyFor(photo.uuid);
      const upload = await FileSystem.uploadAsync(
        `${API_URL.replace(/\/$/, '')}/images/${encodeURIComponent(key)}`,
        uri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${token}`,
            'content-type': 'image/jpeg',
          },
        },
      );

      if (upload.status < 200 || upload.status >= 300) {
        result.failed += 1;
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
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
