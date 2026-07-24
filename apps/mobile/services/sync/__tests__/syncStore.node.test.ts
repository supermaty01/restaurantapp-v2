import { makeTestDb } from '@/services/db/__tests__/test-db';
import {
  getSyncState,
  requestSync,
  resetSyncStateForTests,
  subscribeToSync,
} from '@/services/sync/syncStore';

// The store calls runSync, which talks to Supabase; stub it so these tests
// exercise only the singleton/concurrency behaviour.
const mockRunSync = jest.fn();
jest.mock('@/services/sync/syncManager', () => ({
  runSync: (...args: unknown[]) => mockRunSync(...args),
}));

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

describe('sync store', () => {
  beforeEach(() => {
    resetSyncStateForTests();
    mockRunSync.mockReset();
  });

  it('runs a single pass and records the outcome', async () => {
    const { db } = makeTestDb();
    mockRunSync.mockResolvedValue({ ok: true, error: null, at: 'now' });

    await requestSync(db, ACCOUNT);

    expect(mockRunSync).toHaveBeenCalledTimes(1);
    expect(getSyncState().status).toBe('ok');
  });

  it('joins an in-flight pass instead of starting a second one', async () => {
    // Regression: useSync is mounted twice (SyncRunner + account screen); a
    // per-hook guard let two syncs run at once (double push, racing cursors).
    const { db } = makeTestDb();
    let release: (v: unknown) => void = () => {};
    mockRunSync.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const first = requestSync(db, ACCOUNT);
    const second = requestSync(db, ACCOUNT);
    expect(mockRunSync).toHaveBeenCalledTimes(1);

    release({ ok: true, error: null, at: 'now' });
    await Promise.all([first, second]);
    expect(mockRunSync).toHaveBeenCalledTimes(1);
  });

  it('allows a new pass once the previous finished', async () => {
    const { db } = makeTestDb();
    mockRunSync.mockResolvedValue({ ok: true, error: null, at: 'now' });

    await requestSync(db, ACCOUNT);
    await requestSync(db, ACCOUNT);

    expect(mockRunSync).toHaveBeenCalledTimes(2);
  });

  it('reports an error outcome without throwing', async () => {
    const { db } = makeTestDb();
    mockRunSync.mockResolvedValue({ ok: false, error: 'offline', at: 'now' });

    await requestSync(db, ACCOUNT);

    expect(getSyncState().status).toBe('error');
    expect(getSyncState().lastOutcome?.error).toBe('offline');
  });

  it('notifies subscribers on state change', async () => {
    const { db } = makeTestDb();
    mockRunSync.mockResolvedValue({ ok: true, error: null, at: 'now' });
    const listener = jest.fn();
    const unsubscribe = subscribeToSync(listener);

    await requestSync(db, ACCOUNT);

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
