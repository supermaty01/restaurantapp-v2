// In-memory stand-in for expo-secure-store, so the chunking logic can be tested
// in node. Must be declared before the import that pulls the module in.
import { secureStorage } from './secureStorage';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    mockStore.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    mockStore.delete(k);
  },
}));

/**
 * The Supabase session lives here. A bug in the chunking silently logs the user
 * out (or, worse, returns a torn session), so the round-trip is worth pinning.
 */
describe('secureStorage', () => {
  beforeEach(() => mockStore.clear());

  it('round-trips a short value', async () => {
    await secureStorage.setItem('session', 'hello');
    expect(await secureStorage.getItem('session')).toBe('hello');
  });

  it('round-trips a value larger than one chunk', async () => {
    // A real Supabase session comfortably exceeds the 2KB SecureStore limit.
    const big = 'x'.repeat(5000);
    await secureStorage.setItem('session', big);

    expect(await secureStorage.getItem('session')).toBe(big);
    // Stored split across numbered chunks, not one oversized entry.
    expect(Number(mockStore.get('session'))).toBeGreaterThan(1);
  });

  it('returns null for a key that was never written', async () => {
    expect(await secureStorage.getItem('missing')).toBeNull();
  });

  it('removes every chunk, leaving nothing behind', async () => {
    await secureStorage.setItem('session', 'y'.repeat(5000));
    await secureStorage.removeItem('session');

    expect(await secureStorage.getItem('session')).toBeNull();
    expect([...mockStore.keys()]).toHaveLength(0);
  });

  it('does not leak chunks when a long value is replaced by a short one', async () => {
    await secureStorage.setItem('session', 'z'.repeat(5000));
    await secureStorage.setItem('session', 'small');

    expect(await secureStorage.getItem('session')).toBe('small');
    // Only the count key + one chunk remain — no orphans from the long value.
    expect([...mockStore.keys()].sort()).toEqual(['session', 'session.0']);
  });

  it('treats a torn write (missing chunk) as absent rather than returning half a session', async () => {
    await secureStorage.setItem('session', 'w'.repeat(5000));
    mockStore.delete('session.1');

    expect(await secureStorage.getItem('session')).toBeNull();
  });

  it('round-trips an empty value', async () => {
    await secureStorage.setItem('session', '');
    expect(await secureStorage.getItem('session')).toBe('');
  });
});
