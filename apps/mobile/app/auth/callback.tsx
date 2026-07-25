import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';

/**
 * Where an OAuth redirect lands.
 *
 * `restaurantapp://auth/callback` is what Supabase is told to return to, but
 * this route did not exist — so whenever the system delivered the deep link to
 * the app rather than back through the in-app browser, expo-router found no
 * match and showed "página no encontrada". That is what you hit after
 * dismissing a provider error: the browser closes, Android hands the URL to the
 * app, and the app had nowhere to put it.
 *
 * Usually `signInWithOAuth` has already consumed the redirect by the time this
 * mounts and there is nothing left to do but leave. When it has not — a cold
 * start, or a browser tab dismissed early — this finishes the exchange itself.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { completeOAuth, session } = useAuth();
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

      const url = await Linking.getInitialURL();
      if (!url) {
        router.replace('/(main)/(tabs)');
        return;
      }

      const result = await completeOAuth(url);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace('/(main)/(tabs)');
    })();
  }, [completeOAuth, router, session]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <EmptyState
          icon="log-in-outline"
          title="No se pudo completar el inicio de sesión"
          message={error}
          action={
            <Button label="Volver" onPress={() => router.replace('/(main)/(tabs)')} />
          }
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
