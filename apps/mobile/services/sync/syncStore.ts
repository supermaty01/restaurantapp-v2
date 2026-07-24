import type { AppDatabase } from '@/services/db/types';
import { runSync, type SyncOutcome } from '@/services/sync/syncManager';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastOutcome: SyncOutcome | null;
}

/**
 * Module-level sync state, shared by every `useSync()` consumer.
 *
 * Sync must be a singleton: the hook is mounted in more than one place (the
 * headless SyncRunner and the account screen), and a per-instance guard would
 * let two passes run at once — double push, racing cursors. Concurrent callers
 * here await the same in-flight run instead.
 */
let state: SyncState = { status: 'idle', lastOutcome: null };
let inFlight: Promise<SyncOutcome> | null = null;
const listeners = new Set<() => void>();

function setState(next: SyncState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeToSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncState(): SyncState {
  return state;
}

/**
 * Runs one sync pass, or joins the one already running. Never throws — the
 * outcome carries any error (docs/03).
 */
export async function requestSync(db: AppDatabase, accountUuid: string): Promise<SyncOutcome> {
  if (inFlight) return inFlight;

  setState({ status: 'syncing', lastOutcome: state.lastOutcome });

  inFlight = runSync(db, accountUuid).then((outcome) => {
    setState({ status: outcome.ok ? 'ok' : 'error', lastOutcome: outcome });
    inFlight = null;
    return outcome;
  });

  return inFlight;
}

/** Test-only: clears state between cases. */
export function resetSyncStateForTests(): void {
  state = { status: 'idle', lastOutcome: null };
  inFlight = null;
  listeners.clear();
}
