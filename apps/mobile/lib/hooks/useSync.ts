import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/context/AuthContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { subscribeToLocalChanges } from '@/services/sync/pending';
import { needsDivergenceChoice } from '@/services/sync/resolveDivergence';
import { createSupabaseTransport } from '@/services/sync/supabaseTransport';
import { getSyncState, requestSync, subscribeToSync } from '@/services/sync/syncStore';

/**
 * How long to wait after a write before syncing.
 *
 * Saving one entry writes the row, its links and its photos as separate
 * statements, so a sync fired on the first of them would push a half-written
 * entry and immediately need a second pass. Long enough to let a save settle,
 * short enough that the person you just tagged hears about it while you are
 * still looking at the screen.
 */
const SETTLE_MS = 2500;

export type { SyncStatus } from '@/services/sync/syncStore';

/**
 * Drives background sync while logged in (docs/03): on login, when the app
 * returns to the foreground, shortly after any local write, and on demand. Sync only runs with an account; in
 * anonymous mode this is a no-op. Reads/writes always hit local SQLite — this
 * never blocks the UI.
 *
 * State lives in a module-level store, so mounting this hook in several places
 * (SyncRunner + the account screen) still yields a single sync at a time.
 */
export function useSync() {
  const db = useDatabase();
  const { accountUuid } = useAuth();
  const { status, lastOutcome, photos } = useSyncExternalStore(subscribeToSync, getSyncState);
  /**
   * Hay dos diarios y nadie ha elegido cual manda.
   *
   * Se expone en vez de navegar desde aqui: este hook se monta en dos sitios
   * (SyncRunner y la pantalla de cuenta), asi que un `router.push` aqui dentro
   * abriria la pantalla dos veces. Navegar es cosa de quien se monta una sola
   * vez.
   */
  const [needsChoice, setNeedsChoice] = useState(false);

  const syncNow = useCallback(async () => {
    if (!accountUuid) return;
    await requestSync(db, accountUuid);
  }, [db, accountUuid]);

  /*
   * On login (and account change) — pero antes hay que mirar si hay dos
   * diarios.
   *
   * El orden importa y no es reversible: sincronizar primero **ya combina**, y
   * preguntar después qué quieres hacer sería preguntar por algo que ya pasó.
   * Así que si este dispositivo tiene entradas y la cuenta también, y nadie ha
   * elegido todavía, se para aquí y se manda a elegir.
   *
   * Cualquier fallo comprobándolo (sin red, la RPC de conteos que no está)
   * sincroniza igual: el peor caso de la comprobación es no llegar a preguntar
   * y combinar, que es lo que hacía siempre. Bloquear el sync porque no se pudo
   * contar sería cambiar una duda por una avería.
   */
  useEffect(() => {
    if (!accountUuid) return;

    let cancelled = false;
    void (async () => {
      try {
        if (await needsDivergenceChoice(db, createSupabaseTransport(accountUuid), accountUuid)) {
          if (!cancelled) setNeedsChoice(true);
          return;
        }
      } catch {
        // Se sincroniza igual.
      }
      if (!cancelled) await syncNow();
    })();

    return () => {
      cancelled = true;
    };
  }, [accountUuid, syncNow, db]);

  // Shortly after a local write. Each new change pushes the timer out, so
  // saving three things in a row is one sync and not three.
  useEffect(() => {
    if (!accountUuid) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToLocalChanges(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void syncNow();
      }, SETTLE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [accountUuid, syncNow]);

  // On returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  return { status, lastOutcome, photos, syncNow, needsChoice, isSignedIn: accountUuid !== null };
}
