import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/context/AuthContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { getSyncState, requestSync, subscribeToSync } from '@/services/sync/syncStore';

export type { SyncStatus } from '@/services/sync/syncStore';

/**
 * Drives background sync while logged in (docs/03): on login, when the app
 * returns to the foreground, and on demand. Sync only runs with an account; in
 * anonymous mode this is a no-op. Reads/writes always hit local SQLite — this
 * never blocks the UI.
 *
 * State lives in a module-level store, so mounting this hook in several places
 * (SyncRunner + the account screen) still yields a single sync at a time.
 */
export function useSync() {
  const db = useDatabase();
  const { accountUuid } = useAuth();
  const { status, lastOutcome } = useSyncExternalStore(subscribeToSync, getSyncState);

  const syncNow = useCallback(async () => {
    if (!accountUuid) return;
    await requestSync(db, accountUuid);
  }, [db, accountUuid]);

  // On login (and account change).
  useEffect(() => {
    if (accountUuid) void syncNow();
  }, [accountUuid, syncNow]);

  // On returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  return { status, lastOutcome, syncNow, isSignedIn: accountUuid !== null };
}
