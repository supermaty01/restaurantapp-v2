import { Newsreader_500Medium, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { Suspense, useState, createContext, useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { IntentHandler } from '@/components/IntentHandler';
import { PushRunner } from '@/components/PushRunner';
import { SyncRunner } from '@/components/SyncRunner';
import { CrashScreen } from '@/components/ui/CrashScreen';
import { DialogProvider } from '@/components/ui/Dialog';
import { ToastProvider } from '@/components/ui/Toast';
import migrations from '@/drizzle/migrations';
import '../global.css';
import { AuthProvider } from '@/lib/context/AuthContext';
import { NewDishProvider } from '@/lib/context/NewDishContext';
import { NewRestaurantProvider } from '@/lib/context/NewRestaurantContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { lightColors } from '@/lib/design/tokens';
import { ensureAppDirectories } from '@/lib/helpers/directory-setup';
import { DATABASE_NAME } from '@/services/db/constants';

import type { ErrorBoundaryProps } from 'expo-router';
// Contexto para exponer la función que “bump” la versión de la BBDD
export const DBVersionContext = createContext<() => void>(() => {});

// Held until fonts and the schema are ready, so the first frame is the real UI
// and not a flash of fallback type.
void SplashScreen.preventAutoHideAsync();

/** Full-screen spinner on the app background, used before the theme exists. */
function Booting() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator size="large" color={lightColors.primary} />
    </View>
  );
}

/**
 * Runs the Drizzle migrations inside the SQLiteProvider and **gates the app on
 * them**.
 *
 * `useMigrations` is asynchronous: rendering the children right away let the
 * first screens query the database before the tables existed, which on a fresh
 * install failed with "no such table: app_settings". Nothing renders until the
 * schema is ready.
 */
function MigrationsRunner({ children }: { children: React.ReactNode }) {
  const sqliteDb = useSQLiteContext();
  const db = drizzle(sqliteDb);
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    // A failed migration must be loud: continuing would risk writing against a
    // half-built schema (docs/09 — data must never be lost silently).
    return (
      <View className="flex-1 items-center justify-center bg-canvas p-6">
        <Text className="mb-2 font-display text-xl text-ink">
          No se pudo preparar la base de datos
        </Text>
        <Text className="text-center text-ink-muted">{error.message}</Text>
      </View>
    );
  }

  if (!success) return <Booting />;

  return <>{children}</>;
}

/**
 * Expo Router renders this instead of the tree when a route throws.
 *
 * Exported from the root layout, so it covers every screen. Without it a render
 * error in a release build leaves a blank rectangle and no way back — and to
 * the person holding the phone that is indistinguishable from having lost their
 * diary.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

export default function RootLayout() {
  // Cada vez que incrementemos dbVersion, forzamos el remount de SQLiteProvider
  const [dbVersion, setDbVersion] = useState(0);

  const [fontsLoaded, fontError] = useFonts({
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    ensureAppDirectories().catch((error) => {
      console.error('Error al inicializar directorios:', error);
    });
  }, []);

  useEffect(() => {
    // A font that fails to load must not hold the splash screen forever: the
    // app is perfectly usable in the system typeface.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DBVersionContext.Provider value={() => setDbVersion((v) => v + 1)}>
          <Suspense fallback={<Booting />}>
            <SQLiteProvider
              key={dbVersion}
              databaseName={DATABASE_NAME}
              options={{ enableChangeListener: true }}
              useSuspense
            >
              <MigrationsRunner>
                <AuthProvider>
                  <ThemeProvider>
                    <DialogProvider>
                      <ToastProvider>
                        <NewRestaurantProvider>
                          <NewDishProvider>
                            <IntentHandler />
                            <SyncRunner />
                            <PushRunner />
                            <Slot />
                          </NewDishProvider>
                        </NewRestaurantProvider>
                      </ToastProvider>
                    </DialogProvider>
                  </ThemeProvider>
                </AuthProvider>
              </MigrationsRunner>
            </SQLiteProvider>
          </Suspense>
        </DBVersionContext.Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
