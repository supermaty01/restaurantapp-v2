import type { AppDatabase } from '@/services/db/types';
import type { RowProgress } from '@/services/sync/engine';
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

/** Cómo se lee el avance de las filas. Mismo motivo que `SYNC_LABEL`. */
const ROW_TABLE_LABEL: Record<string, string> = {
  restaurants: 'lugares',
  dishes: 'platos',
  visits: 'visitas',
  tags: 'etiquetas',
  people: 'personas',
  images: 'fotos',
};

export function rowProgressLabel(progress: RowProgress): string {
  const what = ROW_TABLE_LABEL[progress.table] ?? progress.table;
  const verb = progress.phase === 'push' ? 'Subiendo' : 'Bajando';
  // Sin total en el pull: no se sabe cuántas filas hay al otro lado, y un
  // "de N" que crece miente peor que no estar.
  const count =
    progress.total === null ? `${progress.done}` : `${progress.done} de ${progress.total}`;
  return `${verb} ${what} · ${count}`;
}

export interface SyncState {
  status: SyncStatus;
  lastOutcome: SyncOutcome | null;
  /**
   * Por dónde va la parte de filas, que es la que congelaba la app.
   *
   * Se pone a null en cuanto empiezan las fotos: las dos fases no ocurren a la
   * vez y enseñar las dos deja la tarjeta diciendo dos cosas distintas.
   */
  rows: RowProgress | null;
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
let state: SyncState = { status: 'idle', lastOutcome: null, rows: null, photos: null };
let inFlight: Promise<SyncOutcome> | null = null;
/**
 * Alguien pidió sincronizar mientras la pasada anterior seguía corriendo.
 *
 * Se guarda en vez de descartarse. La pasada en curso **ya hizo su push**, así
 * que unirse a ella no envía lo que se acaba de escribir: se quedaba en el móvil
 * hasta el siguiente arranque. Es exactamente lo que pasaba al etiquetar a
 * alguien mientras subían las fotos de la entrada anterior —la parte lenta, que
 * dura minutos—: la persona etiquetada no se enteraba hasta que quien la
 * etiquetó volvía a abrir la app.
 *
 * Una sola pendiente y no una cola: la pasada siguiente drena la bandeja entera,
 * así que tres peticiones durante la misma sincronización son una repetición y
 * no tres.
 */
let queued: { db: AppDatabase; accountUuid: string } | null = null;
/**
 * Hay una pregunta de «¿qué diario manda?» sin contestar.
 *
 * Mientras esté puesta no se sincroniza, y ese es el punto: sincronizar **es**
 * combinar, así que una pasada disparada por volver al primer plano contestaría
 * la pregunta por su cuenta mientras la pantalla sigue abierta. Cerrarla sin
 * elegir dejaba justo eso.
 *
 * Solo en memoria, a propósito: si algo saliera mal y la marca se quedase
 * puesta, reiniciar la app la limpia y se vuelve a evaluar desde los datos.
 */
let awaitingChoice = false;
const listeners = new Set<() => void>();

function setState(next: SyncState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeToSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Lo llama el motor mientras se mueven filas, en cualquier dirección. */
export function reportRowProgress(progress: RowProgress): void {
  setState({ ...state, rows: progress });
}

/** Lo llama el gestor de sync mientras se mueven las fotos, en cualquier dirección. */
export function reportPhotoProgress(progress: PhotoProgress): void {
  setState({ ...state, rows: null, photos: progress });
}

export function getSyncState(): SyncState {
  return state;
}

/** Lo pone `useSync` al detectar dos diarios; lo quita la pantalla al elegir. */
export function setAwaitingDivergenceChoice(pending: boolean): void {
  awaitingChoice = pending;
}

/**
 * Runs one sync pass. Never throws — the outcome carries any error (docs/03).
 *
 * Si ya hay una en marcha, **no se descarta la petición**: se anota y se hace
 * otra pasada al terminar. Devolver la que está corriendo parecía razonable —es
 * idempotente, y dos a la vez se pisarían los cursores— pero contesta a otra
 * pregunta: quien pide sincronizar después de guardar algo pregunta si *eso*
 * llegó, y la pasada en curso ya envió lo suyo antes de que existiera.
 */
export async function requestSync(db: AppDatabase, accountUuid: string): Promise<SyncOutcome> {
  if (awaitingChoice) {
    return { ok: false, error: 'Hay dos diarios sin resolver', at: new Date().toISOString() };
  }
  if (inFlight) {
    queued = { db, accountUuid };
    return inFlight;
  }

  setState({ status: 'syncing', lastOutcome: state.lastOutcome, rows: null, photos: null });

  inFlight = runSync(db, accountUuid, { onRows: reportRowProgress, onPhotos: reportPhotoProgress })
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
      setState({
        status: outcome.ok ? 'ok' : 'error',
        lastOutcome: outcome,
        rows: null,
        photos: null,
      });
      inFlight = null;

      // Lo que se pidió mientras corría esta. Se lanza sin esperarlo: quien
      // llamó pregunta por *su* pasada, y encadenar la siguiente a la respuesta
      // dejaría la tarjeta de perfil en «Sincronizando» durante las dos.
      const next = queued;
      queued = null;
      if (next) void requestSync(next.db, next.accountUuid);

      return outcome;
    });

  return inFlight;
}

/** Test-only: clears state between cases. */
export function resetSyncStateForTests(): void {
  state = { status: 'idle', lastOutcome: null, rows: null, photos: null };
  inFlight = null;
  queued = null;
  awaitingChoice = false;
  listeners.clear();
}
