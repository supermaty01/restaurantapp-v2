import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { describeAuthError } from '@/lib/helpers/auth-errors';
import { devLog } from '@/lib/helpers/dev-log';
import { parseOAuthCallback } from '@/lib/helpers/oauth-callback';
import { redactUrl } from '@/lib/helpers/redact';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';

import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

export type OAuthProvider = 'google' | 'apple';

interface AuthResult {
  error: string | null;
}

/**
 * Lo que pasó al crear una cuenta.
 *
 * `needsConfirmation` existe porque `signUp` **no falla** cuando el proyecto
 * pide confirmar el correo: devuelve un usuario sin sesión y ya está. La
 * pantalla no distinguía ese caso de un registro con sesión inmediata, así que
 * pulsar «Crear cuenta» no hacía nada visible — ni error, ni sesión, ni una
 * frase diciendo que había que mirar el correo.
 */
export interface SignUpResult extends AuthResult {
  needsConfirmation: boolean;
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
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<AuthResult>;
  /** Completes a login from a redirect the system delivered to the app. */
  completeOAuth: (url: string) => Promise<AuthResult>;
  /** Manda el correo para poner una contraseña nueva. */
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

/**
 * Esta copia de la app no tiene nube configurada.
 *
 * Escrito para leerse: antes era la cadena `not-configured`, que llegaba tal
 * cual al diálogo de error. Nadie que vea «not-configured» en su móvil sabe qué
 * hacer con eso.
 */
const NOT_CONFIGURED = 'Esta copia de la app funciona solo en local: no tiene cuenta configurada.';

const AuthContext = createContext<AuthContextValue>({
  isConfigured: false,
  loading: false,
  session: null,
  accountUuid: null,
  signInWithEmail: async () => ({ error: NOT_CONFIGURED }),
  signUpWithEmail: async () => ({ error: NOT_CONFIGURED, needsConfirmation: false }),
  signInWithOAuth: async () => ({ error: NOT_CONFIGURED }),
  completeOAuth: async () => ({ error: NOT_CONFIGURED }),
  resetPassword: async () => ({ error: NOT_CONFIGURED }),
  signOut: async () => {},
});

// Deep link the OAuth flow returns to (declared in app.config.js scheme).
const REDIRECT_TO = 'restaurantapp://auth/callback';

/**
 * Exchanges already under way, keyed by authorization code.
 *
 * A PKCE flow state is single use, and the same redirect legitimately reaches
 * the app twice: `openAuthSessionAsync` resolves with it *and* the system
 * delivers the deep link to `auth/callback`. Both called
 * `exchangeCodeForSession`; the first succeeded and the second came back
 * `flow_state_not_found`, so a login that had actually worked showed an error.
 *
 * Module level, not a ref: on a development build the deep link relaunches the
 * app and the two attempts can even land in different component instances.
 */
const exchanges = new Map<string, Promise<AuthResult>>();

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
      if (!supabase) return { error: NOT_CONFIGURED };
      // El correo, siempre en minúsculas: los proveedores lo tratan sin
      // distinguir mayúsculas y quien lo escribe con el teclado en automático
      // manda "Mateo@..." y se queda fuera de su propia cuenta.
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      // Traducido, no crudo: Supabase contesta en inglés y eso salía tal cual.
      return { error: error ? describeAuthError(error.message) : null };
    },
    [supabase],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      if (!supabase) return { error: NOT_CONFIGURED, needsConfirmation: false };

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) return { error: describeAuthError(error.message), needsConfirmation: false };

      /*
       * Sin sesión y con usuario significa "te hemos mandado un correo".
       *
       * Es la única señal que da Supabase cuando el proyecto exige confirmar, y
       * sin mirarla la pantalla se quedaba igual que antes de pulsar: ni error,
       * ni sesión, ni una frase. Parecía que el botón no funcionaba.
       *
       * El caso raro de un correo ya registrado también cae aquí —Supabase no
       * lo delata, a propósito, para no decirle a nadie qué correos existen— y
       * el mensaje sirve igual: mira tu correo.
       */
      return { error: null, needsConfirmation: data.session === null };
    },
    [supabase],
  );

  const resetPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!supabase) return { error: NOT_CONFIGURED };
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: REDIRECT_TO,
      });
      return { error: error ? describeAuthError(error.message) : null };
    },
    [supabase],
  );

  /**
   * Turns an OAuth redirect URL into a session.
   *
   * Shared by two entry points: `openAuthSessionAsync`, which normally returns
   * the redirect straight to us, and the `auth/callback` route, which catches
   * it when the system delivers the deep link to the app instead — a cold
   * start, or a browser tab that had already been dismissed.
   */
  const completeOAuth = useCallback(
    async (url: string): Promise<AuthResult> => {
      if (!supabase) return { error: NOT_CONFIGURED };

      const callback = parseOAuthCallback(url);
      devLog('Auth', 'redirect recibido:', redactUrl(url));
      devLog('Auth', 'interpretado como:', callback.type);

      switch (callback.type) {
        case 'code': {
          const pending = exchanges.get(callback.code);
          if (pending) {
            devLog('Auth', 'ya se está canjeando este código; esperando al primero');
            return pending;
          }

          const attempt = (async (): Promise<AuthResult> => {
            const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);

            if (!error) {
              devLog('Auth', 'sesión creada para', data.session?.user.email ?? '(sin email)');
              return { error: null };
            }

            devLog(
              'Auth',
              'exchangeCodeForSession falló:',
              error.message,
              `(status ${error.status ?? '?'})`,
            );

            // A consumed flow state means someone got there first. If that
            // attempt produced a session, the login worked and this is noise.
            const { data: current } = await supabase.auth.getSession();
            if (current.session) {
              devLog('Auth', 'pero ya hay sesión: el canje lo completó otro intento');
              return { error: null };
            }

            return { error: describeAuthError(error.message) };
          })();

          exchanges.set(callback.code, attempt);
          try {
            return await attempt;
          } finally {
            // Kept briefly so a late duplicate still finds it, then dropped so
            // the map cannot grow across sessions.
            setTimeout(() => exchanges.delete(callback.code), 30_000);
          }
        }
        case 'session': {
          const { error } = await supabase.auth.setSession({
            access_token: callback.accessToken,
            refresh_token: callback.refreshToken,
          });
          return { error: error?.message ?? null };
        }
        case 'error':
          // Supabase itself failed the exchange with the provider and passed
          // the reason back in the redirect. Nothing the app did causes this,
          // so the message says who can actually fix it.
          devLog('Auth', 'el proveedor devolvió un error:', callback.message);
          return { error: describeAuthError(callback.message) };
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

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider): Promise<AuthResult> => {
      if (!supabase) return { error: NOT_CONFIGURED };

      // Ask Supabase for the provider URL, open it, and exchange the code the
      // deep-link redirect carries back. Standard Expo + Supabase OAuth flow.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        devLog('Auth', 'signInWithOAuth no devolvió URL:', error?.message ?? '(sin error)');
        return {
          error: error
            ? describeAuthError(error.message)
            : 'El proveedor no devolvió ninguna dirección de acceso. Revisa que esté habilitado en Supabase.',
        };
      }

      devLog('Auth', 'abriendo:', redactUrl(data.url));
      devLog('Auth', 'redirectTo:', REDIRECT_TO);

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_TO);
      devLog('Auth', 'el navegador cerró con:', result.type);
      // Cerrar el navegador no es un fallo: es haber cambiado de idea. Antes
      // devolvía `cancelled`, que la pantalla enseñaba como un error rojo con
      // esa misma palabra en inglés.
      if (result.type !== 'success') return { error: null };

      return completeOAuth(result.url);
    },
    [supabase, completeOAuth],
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
      completeOAuth,
      resetPassword,
      signOut,
    }),
    [
      loading,
      session,
      signInWithEmail,
      signUpWithEmail,
      signInWithOAuth,
      completeOAuth,
      resetPassword,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
