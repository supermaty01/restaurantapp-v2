import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { devLog } from '@/lib/helpers/dev-log';
import { redactUrl } from '@/lib/helpers/redact';

const REDIRECT_BASE = 'restaurantapp://auth/callback';

/**
 * Where an OAuth redirect lands.
 *
 * `restaurantapp://auth/callback` is what Supabase is told to return to, but
 * this route did not exist — so whenever the system delivered the deep link to
 * the app rather than back through the in-app browser, expo-router found no
 * match and showed "página no encontrada".
 *
 * On a development build that is the *normal* path, not the exception: opening
 * the deep link relaunches the app through expo-development-client, which tears
 * down the JS context, so the promise `openAuthSessionAsync` returned never
 * resolves and this screen is what actually completes the login.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { completeOAuth, session } = useAuth();
  const params = useLocalSearchParams<Record<string, string>>();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    void (async () => {
      // Already signed in: the in-app browser flow got there first.
      if (session) {
        router.replace('/(main)/(tabs)');
        return;
      }

      const url = await resolveCallbackUrl(params);
      if (!url) {
        devLog('Auth', 'callback sin credenciales; volviendo al inicio');
        router.replace('/(main)/(tabs)');
        return;
      }

      devLog('Auth', 'completando desde la ruta:', redactUrl(url));
      const result = await completeOAuth(url);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace('/(main)/(tabs)');
    })();
  }, [completeOAuth, params, router, session]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <EmptyState
          icon="log-in-outline"
          title="No se pudo completar el inicio de sesión"
          message={error}
          action={<Button label="Volver" onPress={() => router.replace('/(main)/(tabs)')} />}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-canvas">
      <ActivityIndicator size="large" color={colors.primary} />
      <Txt variant="callout" tone="subtle">
        Terminando de entrar…
      </Txt>
    </View>
  );
}

/**
 * Rebuilds the callback URL from whatever the router actually received.
 *
 * The route's own params come first because they are the only source that is
 * definitely *this* redirect. `getInitialURL` is the fallback, and it has to be
 * filtered: on a development build it returns the dev-client's launch URL
 * (`restaurantapp://expo-development-client/?url=http://192.168…`), which
 * parsed as an OAuth response looks like a redirect carrying one unknown
 * parameter — which is exactly the useless error this screen used to show.
 */
async function resolveCallbackUrl(params: Record<string, string>): Promise<string | null> {
  const query = Object.entries(params)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  if (query) return `${REDIRECT_BASE}?${query}`;

  const initial = await Linking.getInitialURL();
  if (!initial || initial.includes('expo-development-client')) return null;
  return initial;
}
