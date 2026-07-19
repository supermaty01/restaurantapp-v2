import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/context/AuthContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { runSync, type SyncOutcome } from '@/services/sync/syncManager';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

/**
 * Drives background sync while logged in (docs/03): on login, when the app
 * returns to the foreground, and on demand. Sync only runs with an account; in
 * anonymous mode this is a no-op. Reads/writes always hit local SQLite — this
 * never blocks the UI.
 */
export function useSync() {
  const db = useDatabase();
  const { accountUuid } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastOutcome, setLastOutcome] = useState<SyncOutcome | null>(null);
  const running = useRef(false);

  const syncNow = useCallback(async () => {
    if (!accountUuid || running.current) return;
    running.current = true;
    setStatus('syncing');
    const outcome = await runSync(db, accountUuid);
    setLastOutcome(outcome);
    setStatus(outcome.ok ? 'ok' : 'error');
    running.current = false;
  }, [db, accountUuid]);

  // On login (and account change).
  useEffect(() => {
    if (accountUuid) void syncNow();
  }, [accountUuid, syncNow]);

  // On returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  return { status, lastOutcome, syncNow, isSignedIn: accountUuid !== null };
}
