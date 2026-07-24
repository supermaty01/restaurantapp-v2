import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { devLog } from '@/lib/helpers/dev-log';
import { parseOAuthCallback } from '@/lib/helpers/oauth-callback';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';

import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

export type OAuthProvider = 'google' | 'apple';

interface AuthResult {
  error: string | null;
}

interface AuthContextValue {
  /** Whether accounts are available at all (env configured). */
  isConfigured: boolean;
  /** Loading the initial session. */
  loading: boolean;
  session: Session | null;
  /** The logged-in account uuid, or null in anonymous mode. */
  accountUuid: string | null;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isConfigured: false,
  loading: false,
  session: null,
  accountUuid: null,
  signInWithEmail: async () => ({ error: 'not-configured' }),
  signUpWithEmail: async () => ({ error: 'not-configured' }),
  signInWithOAuth: async () => ({ error: 'not-configured' }),
  signOut: async () => {},
});

// Deep link the OAuth flow returns to (declared in app.config.js scheme).
const REDIRECT_TO = 'restaurantapp://auth/callback';

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    // The cloud is optional: if Supabase is unreachable (no network, a local
    // instance the device can't see, a wrong URL), the app must still start in
    // anonymous mode. Without this catch the rejection is unhandled and
    // `loading` never clears, hanging the UI.
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error: unknown) => {
        console.warn('No se pudo recuperar la sesión:', error);
      })
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { error: 'not-configured' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { error: 'not-configured' };
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider): Promise<AuthResult> => {
      if (!supabase) return { error: 'not-configured' };

      // Ask Supabase for the provider URL, open it, and exchange the code the
      // deep-link redirect carries back. Standard Expo + Supabase OAuth flow.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
      });
      if (error || !data.url) return { error: error?.message ?? 'oauth-url-missing' };

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_TO);
      if (result.type !== 'success') return { error: 'cancelled' };

      // The redirect can come back as a PKCE code, as ready-made tokens, or as
      // an error — all three have to be handled or the login dead-ends.
      const callback = parseOAuthCallback(result.url);
      devLog('Auth', 'OAuth callback:', callback.type);

      switch (callback.type) {
        case 'code': {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            callback.code,
          );
          return { error: exchangeError?.message ?? null };
        }
        case 'session': {
          const { error: setError } = await supabase.auth.setSession({
            access_token: callback.accessToken,
            refresh_token: callback.refreshToken,
          });
          return { error: setError?.message ?? null };
        }
        case 'error':
          return { error: callback.message };
        case 'unrecognised':
          return {
            error: `El proveedor no devolvió ninguna credencial${
              callback.params.length ? ` (recibido: ${callback.params.join(', ')})` : ''
            }. Revisa que ${REDIRECT_TO} esté en las Redirect URLs de Supabase.`,
          };
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    // Sign out stops sync but never touches local data (docs/04).
    await supabase?.auth.signOut();
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      loading,
      session,
      accountUuid: session?.user.id ?? null,
      signInWithEmail,
      signUpWithEmail,
      signInWithOAuth,
      signOut,
    }),
    [loading, session, signInWithEmail, signUpWithEmail, signInWithOAuth, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
