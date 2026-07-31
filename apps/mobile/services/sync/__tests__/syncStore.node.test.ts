import { makeTestDb } from '@/services/db/__tests__/test-db';
import {
  getSyncState,
  requestSync,
  resetSyncStateForTests,
  subscribeToSync,
  SYNC_LABEL,
} from '@/services/sync/syncStore';

// The store calls runSync, which talks to Supabase; stub it so these tests
// exercise only the singleton/concurrency behaviour.
const mockRunSync = jest.fn();
jest.mock('@/services/sync/syncManager', () => ({
  runSync: (...args: unknown[]) => mockRunSync(...args),
}));

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

describe('SYNC_LABEL', () => {
  // `Record<SyncStatus, string>` already forces a label per state. This catches
  // the other half of the same bug: a label that is the machine word itself,
  // which is what the profile card ended up showing.
  it('reads as Spanish, not as a status code', () => {
    for (const [status, label] of Object.entries(SYNC_LABEL)) {
      expect(label).not.toBe(status);
      expect(label.trim().length).toBeGreaterThan(3);
    }
  });
});

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

  it('never runs two passes at once', async () => {
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
  });

  /**
   * Lo que se pide durante una pasada se hace después, no se tira.
   *
   * Unirse a la que corre parecía suficiente y no lo era: esa ya envió lo suyo
   * antes de que existiera lo nuevo. Con fotos subiendo —minutos— guardar una
   * entrada durante ese rato la dejaba en el móvil hasta el siguiente arranque,
   * y a quien acababas de etiquetar sin enterarse.
   */
  it('repite la pasada si algo se pidió mientras corría', async () => {
    const { db } = makeTestDb();
    let release: (v: unknown) => void = () => {};
    mockRunSync
      .mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      )
      .mockResolvedValue({ ok: true, error: null, at: 'now' });

    const first = requestSync(db, ACCOUNT);
    void requestSync(db, ACCOUNT);
    void requestSync(db, ACCOUNT);

    release({ ok: true, error: null, at: 'now' });
    await first;
    // Una repetición, no una por petición: la siguiente pasada drena la bandeja
    // entera, así que tres peticiones seguidas son un solo sync de más.
    await Promise.resolve();
    expect(mockRunSync).toHaveBeenCalledTimes(2);
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
