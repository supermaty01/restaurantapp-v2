import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/context/AuthContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { subscribeToLocalChanges } from '@/services/sync/pending';
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

  const syncNow = useCallback(async () => {
    if (!accountUuid) return;
    await requestSync(db, accountUuid);
  }, [db, accountUuid]);

  // On login (and account change).
  useEffect(() => {
    if (accountUuid) void syncNow();
  }, [accountUuid, syncNow]);

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

  return { status, lastOutcome, photos, syncNow, isSignedIn: accountUuid !== null };
}
