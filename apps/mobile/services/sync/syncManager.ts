import { getDefaults } from '@/features/privacy/defaultsStore';
import { pushVisibilityDefaults } from '@/features/social/api';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine } from '@/services/sync/engine';
import { uploadPendingPhotos } from '@/services/sync/photos';
import { createSupabaseTransport } from '@/services/sync/supabaseTransport';

export interface SyncOutcome {
  ok: boolean;
  error: string | null;
  at: string;
}

/**
 * One sync pass against Supabase. Never throws — a sync failure must never break
 * the app (docs/03); it reports the outcome so the UI can show it.
 */
export async function runSync(db: AppDatabase, accountUuid: string): Promise<SyncOutcome> {
  const engine = new SyncEngine(db, createSupabaseTransport(accountUuid), accountUuid);
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
    const photos = await uploadPendingPhotos(db);
    // Solo cuando queda algo por hacer o algo salió mal. Una tanda que sube
    // entera no necesita anunciarse: la tarjeta de perfil ya dice "Al día", y
    // un log que aparece siempre es un log que se deja de leer.
    if (photos.pending > 0 || photos.failed > 0) {
      console.warn(
        `[sync] fotos: ${photos.uploaded} subidas, ${photos.pending} en cola, ` +
          `${photos.failed} sin poder subir`,
      );
      for (const reason of photos.reasons) console.warn(`[sync] fotos — ${reason}`);
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
