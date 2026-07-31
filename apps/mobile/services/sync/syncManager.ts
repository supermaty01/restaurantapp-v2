import { getDefaults } from '@/features/privacy/defaultsStore';
import { defaultsAreKnown, ensureDefaultsLoaded } from '@/features/privacy/loadDefaults';
import { pushVisibilityDefaults } from '@/features/social/api';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine } from '@/services/sync/engine';
import { downloadMissingPhotos, uploadPendingPhotos } from '@/services/sync/photos';
import { rememberAccountLinked } from '@/services/sync/resolveDivergence';
import { createSupabaseTransport } from '@/services/sync/supabaseTransport';
import { reportPhotoProgress } from '@/services/sync/syncStore';

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
    //
    // Leerlos del disco antes es obligatorio, no una optimización. El almacén
    // en memoria nace en blanco —todo privado— y solo lo rellenaba un hook, así
    // que la primera pasada tras arrancar publicaba `private/private/private`
    // encima de lo elegido y **dejaba de compartir el diario entero** hasta que
    // alguien abriera Ajustes. Si aun así no se sabe cuáles son (lectura
    // fallida), no se publica nada: el servidor no distingue "no lo sé" de "no
    // comparto", y la segunda respuesta esconde el diario.
    await ensureDefaultsLoaded(db);
    if (defaultsAreKnown()) await pushVisibilityDefaults(getDefaults());
    await engine.sync();

    // A partir de aquí este dispositivo y esta cuenta ya no son dos diarios que
    // se encuentran, sino uno solo: nunca hay que volver a preguntar cuál manda.
    // Va aquí y no al final porque las fotos son otra cosa y pueden tardar.
    await rememberAccountLinked(db, accountUuid);

    // After the rows, because a photo is addressed by the row that owns it, and
    // because this is the part that can take minutes: getting the diary itself
    // to the server should not wait behind a slow upload. Never throws — a
    // photo that will not go up must not turn a successful sync into a failure.
    const photos = await uploadPendingPhotos(db, reportPhotoProgress);
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
    const incoming = await downloadMissingPhotos(db, accountUuid, reportPhotoProgress);
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
