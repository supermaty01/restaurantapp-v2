import { createClient } from '@supabase/supabase-js';

import { secureStorage } from './secureStorage';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client, or null when the app is unconfigured.
 *
 * The cloud is optional (docs/00): with no EXPO_PUBLIC_SUPABASE_* env the app
 * runs fully local and every account/sync feature hides itself. Nothing here
 * throws when unconfigured — callers check `isSupabaseConfigured`.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(url as string, anonKey as string, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL to parse a session from.
      detectSessionInUrl: false,
    },
  });
}

/** The client, or null if the cloud isn't configured. */
export function getSupabase(): SupabaseClient | null {
  return client;
}

/** The client, throwing if unconfigured — for code paths already gated on auth. */
export function requireSupabase(): SupabaseClient {
  if (!client) throw new Error('Supabase no está configurado');
  return client;
}
