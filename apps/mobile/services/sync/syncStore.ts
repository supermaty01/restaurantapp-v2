import type { AppDatabase } from '@/services/db/types';
import type { PhotoProgress } from '@/services/sync/photos';
import { runSync, type SyncOutcome } from '@/services/sync/syncManager';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

/**
 * How each state reads to a person.
 *
 * Here rather than in the screen so the two cannot drift: the profile card kept
 * its own map, missed `ok`, and printed the raw status — the word "ok" sitting
 * in the middle of a card written in Spanish. `Record<SyncStatus, string>` makes
 * a new state a type error instead of a string that leaks to the UI.
 */
export const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: 'Sin sincronizar aún',
  syncing: 'Sincronizando…',
  ok: 'Al día',
  error: 'No se pudo sincronizar',
};

/**
 * Cómo se lee el avance de las fotos.
 *
 * Aquí y no en la tarjeta de perfil por el mismo motivo que `SYNC_LABEL`: la
 * tarjeta tenía su propia frase, escrita cuando solo se subía, y siguió diciendo
 * "Subiendo fotos" cuando se añadió la bajada. Un móvil recién estrenado
 * anunciaba que subía mil fotos que en realidad estaba trayéndose.
 */
export function photoProgressLabel(progress: PhotoProgress): string {
  const verb = progress.phase === 'upload' ? 'Subiendo' : 'Descargando';
  return `${verb} fotos · ${progress.done} de ${progress.total}`;
}

export interface SyncState {
  status: SyncStatus;
  lastOutcome: SyncOutcome | null;
  /**
   * Fotos movidas y por mover en la pasada en curso, y en qué dirección.
   *
   * Las fotos son la parte lenta: sin recuento la tarjeta se queda en
   * "Sincronizando" durante minutos y no hay forma de distinguirlo de estar
   * colgado. La **dirección** viene en el dato y no la escribe la pantalla,
   * porque cuando la escribía la pantalla decía "Subiendo fotos" mientras
   * restauraba un móvil vacío, que es justo al revés.
   */
  photos: PhotoProgress | null;
}

/**
 * Module-level sync state, shared by every `useSync()` consumer.
 *
 * Sync must be a singleton: the hook is mounted in more than one place (the
 * headless SyncRunner and the account screen), and a per-instance guard would
 * let two passes run at once — double push, racing cursors. Concurrent callers
 * here await the same in-flight run instead.
 */
let state: SyncState = { status: 'idle', lastOutcome: null, photos: null };
let inFlight: Promise<SyncOutcome> | null = null;
/**
 * Alguien pidió sincronizar mientras la pasada anterior seguía corriendo.
 *
 * Se guarda en vez de descartarse. La pasada en curso ya hizo su push, así que
 * unirse a ella no envía lo que se acaba de escribir: se quedaba en el móvil
 * hasta el siguiente arranque. Es exactamente lo que pasaba al etiquetar a
 * alguien mientras subían las fotos de la entrada anterior —la parte lenta, que
 * dura minutos—: la persona etiquetada no se enteraba hasta que quien la
 * etiquetó volvía a abrir la app.
 */
let queued: { db: AppDatabase; accountUuid: string } | null = null;
const listeners = new Set<() => void>();

function setState(next: SyncState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeToSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Lo llama el gestor de sync mientras se mueven las fotos, en cualquier dirección. */
export function reportPhotoProgress(progress: PhotoProgress): void {
  setState({ ...state, photos: progress });
}

export function getSyncState(): SyncState {
  return state;
}

/**
 * Runs one sync pass. Never throws — the outcome carries any error (docs/03).
 *
 * Si ya hay una en marcha, **no se descarta la petición**: se anota y se hace
 * otra pasada al terminar. Devolver la que está corriendo parecía razonable —es
 * idempotente, dos a la vez se pisarían los cursores— pero contesta a otra
 * pregunta: quien pide sincronizar después de guardar algo pregunta si *eso*
 * llegó, y la pasada en curso ya envió lo suyo antes de que existiera.
 *
 * Una sola pendiente, no una cola: la pasada siguiente drena la bandeja entera,
 * así que tres peticiones durante la misma sincronización son una repetición y
 * no tres.
 */
export async function requestSync(db: AppDatabase, accountUuid: string): Promise<SyncOutcome> {
  if (inFlight) {
    queued = { db, accountUuid };
    return inFlight;
  }

  setState({ status: 'syncing', lastOutcome: state.lastOutcome, photos: null });

  inFlight = runSync(db, accountUuid)
    .catch((error: unknown): SyncOutcome => {
      // runSync already converts failures into outcomes; this is a last resort
      // so an unexpected throw can't leave `inFlight` stuck and block every
      // future sync.
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error de sincronización',
        at: new Date().toISOString(),
      };
    })
    .then((outcome) => {
      setState({ status: outcome.ok ? 'ok' : 'error', lastOutcome: outcome, photos: null });
      inFlight = null;

      const next = queued;
      queued = null;
      if (next) void requestSync(next.db, next.accountUuid);

      return outcome;
    });

  return inFlight;
}

/** Test-only: clears state between cases. */
export function resetSyncStateForTests(): void {
  state = { status: 'idle', lastOutcome: null, photos: null };
  inFlight = null;
  queued = null;
  listeners.clear();
}
