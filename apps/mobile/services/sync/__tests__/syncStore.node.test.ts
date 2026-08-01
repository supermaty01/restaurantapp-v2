import { makeTestDb } from '@/services/db/__tests__/test-db';
import {
  getSyncState,
  requestSync,
  resetSyncStateForTests,
  setAwaitingDivergenceChoice,
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

  it('nunca corre dos pasadas a la vez', async () => {
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

  it('repite la pasada cuando se pidió una mientras corría otra', async () => {
    /*
     * Lo que se veía roto: etiquetar a alguien mientras subían las fotos de la
     * entrada anterior —minutos— y que la persona etiquetada no se enterara
     * hasta que quien la etiquetó volvía a abrir la app. La pasada en curso ya
     * había hecho su push antes de que existiera la etiqueta, así que unirse a
     * ella era esperar por algo que no la incluía.
     */
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
    expect(mockRunSync).toHaveBeenCalledTimes(1);

    release({ ok: true, error: null, at: 'now' });
    await first;
    // La repetición se lanza sin esperarla, así que hay que dejar correr la
    // cola de microtareas antes de mirar.
    await Promise.resolve();

    expect(mockRunSync).toHaveBeenCalledTimes(2);
  });

  it('tres peticiones durante la misma pasada son una repetición, no tres', async () => {
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
    void requestSync(db, ACCOUNT);

    release({ ok: true, error: null, at: 'now' });
    await first;
    await Promise.resolve();

    expect(mockRunSync).toHaveBeenCalledTimes(2);
  });

  it('no sincroniza mientras hay una pregunta de «qué diario manda» abierta', async () => {
    // Sincronizar *es* combinar. Si una pasada de fondo corriera con la pantalla
    // de elección abierta, contestaría la pregunta por su cuenta.
    const { db } = makeTestDb();
    mockRunSync.mockResolvedValue({ ok: true, error: null, at: 'now' });

    setAwaitingDivergenceChoice(true);
    const outcome = await requestSync(db, ACCOUNT);

    expect(mockRunSync).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(false);

    setAwaitingDivergenceChoice(false);
    await requestSync(db, ACCOUNT);
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
