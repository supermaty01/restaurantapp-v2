import { getDefaults } from '@/features/privacy/defaultsStore';
import { pushVisibilityDefaults } from '@/features/social/api';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine, type RowProgress } from '@/services/sync/engine';
import {
  downloadMissingPhotos,
  uploadPendingPhotos,
  type PhotoProgress,
} from '@/services/sync/photos';
import { createSupabaseTransport } from '@/services/sync/supabaseTransport';

export interface SyncOutcome {
  ok: boolean;
  error: string | null;
  at: string;
}

/**
 * A quién avisar del avance.
 *
 * Se reciben en vez de importarse de `syncStore` para romper un ciclo:
 * `syncStore` importa `runSync` de aquí, y esto importaba los reporteros de
 * allí. Metro lo permite y lo avisa en cada arranque —«Require cycle»—, y el
 * aviso no es decorativo: en un ciclo, el módulo que se carga segundo ve como
 * `undefined` lo que el primero aún no ha terminado de definir. Aquí nunca
 * llegó a fallar porque los reporteros solo se llaman mucho después, que es
 * exactamente la clase de fallo que aparece el día que alguien mueve una línea.
 */
export interface SyncProgress {
  onRows: (progress: RowProgress) => void;
  onPhotos: (progress: PhotoProgress) => void;
}

/**
 * One sync pass against Supabase. Never throws — a sync failure must never break
 * the app (docs/03); it reports the outcome so the UI can show it.
 */
export async function runSync(
  db: AppDatabase,
  accountUuid: string,
  progress: SyncProgress,
): Promise<SyncOutcome> {
  const engine = new SyncEngine(
    db,
    createSupabaseTransport(accountUuid),
    accountUuid,
    progress.onRows,
  );
  try {
    // Before the rows, because every row stored as `default` is meaningless to
    // the server until it knows what this account's default *is*. Pushing them
    // afterwards would leave a window where a friend sees nothing.
    await pushVisibilityDefaults(getDefaults());
    await engine.sync();

    // After the rows, because a photo is addressed by the row that owns it, and
    // because this is the part that can take minutes: getting the diary itself
    // to the server should not wait behind a slow upload. Never throws — a
    // photo that will not go up must not turn a successful sync into a failure.
    const photos = await uploadPendingPhotos(db, progress.onPhotos);
    // Solo cuando algo salió mal. Una pasada que sube entera no necesita
    // anunciarse: la tarjeta de perfil ya dice "Al día", y un log que aparece
    // siempre es un log que se deja de leer.
    if (photos.failed > 0) {
      console.warn(`[sync] fotos: ${photos.moved} subidas, ${photos.failed} sin poder subir`);
      for (const reason of photos.reasons) console.warn(`[sync] fotos — ${reason}`);
    }

    // Y de vuelta. Va después de subir porque el caso de un móvil que estrena
    // cuenta es mandar lo suyo primero; el de un móvil que restaura no tiene
    // nada que mandar, así que no espera por nada.
    const incoming = await downloadMissingPhotos(db, accountUuid, progress.onPhotos);
    if (incoming.failed > 0) {
      console.warn(`[sync] fotos: ${incoming.moved} bajadas, ${incoming.failed} sin poder bajar`);
      for (const reason of incoming.reasons) console.warn(`[sync] fotos — ${reason}`);
    }

    return { ok: true, error: null, at: new Date().toISOString() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error de sincronización',
      at: new Date().toISOString(),
    };
  }
}
