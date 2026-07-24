import * as SecureStore from 'expo-secure-store';

/**
 * Storage adapter for supabase-js backed by expo-secure-store.
 *
 * SecureStore warns/refuses above ~2KB per key, but a Supabase session
 * (access + refresh token) can exceed that, so values are split into chunks
 * (`key.0`, `key.1`, …) with the chunk count stored under `key`.
 */
const CHUNK_SIZE = 1800;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(key);
    if (countRaw === null) return null;

    const count = Number(countRaw);
    if (!Number.isInteger(count) || count < 0) return null;
    // Zero chunks is a stored empty string, not an absent key.
    if (count === 0) return '';

    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null; // torn write — treat as absent
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    for (const [i, chunk] of chunks.entries()) {
      await SecureStore.setItemAsync(`${key}.${i}`, chunk);
    }
    await SecureStore.setItemAsync(key, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(key);
    const count = countRaw ? Number(countRaw) : 0;
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};
