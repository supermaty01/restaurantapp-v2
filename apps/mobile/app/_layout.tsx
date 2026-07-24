import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Slot } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { Suspense, useState, createContext, useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IntentHandler } from '@/components/IntentHandler';
import { SyncRunner } from '@/components/SyncRunner';
import migrations from '@/drizzle/migrations';
import '../global.css';
import { AuthProvider } from '@/lib/context/AuthContext';
import { NewDishProvider } from '@/lib/context/NewDishContext';
import { NewRestaurantProvider } from '@/lib/context/NewRestaurantContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { ensureAppDirectories } from '@/lib/helpers/directory-setup';
import { DATABASE_NAME } from '@/services/db/constants';
// Contexto para exponer la función que “bump” la versión de la BBDD
export const DBVersionContext = createContext<() => void>(() => {});

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
      <View className="flex-1 items-center justify-center bg-muted p-6">
        <Text className="text-lg font-bold text-text mb-2">
          No se pudo preparar la base de datos
        </Text>
        <Text className="text-center text-gray-600">{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#905c36" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  // Cada vez que incrementemos dbVersion, forzamos el remount de SQLiteProvider
  const [dbVersion, setDbVersion] = useState(0);

  useEffect(() => {
    ensureAppDirectories().catch((error) => {
      console.error('Error al inicializar directorios:', error);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DBVersionContext.Provider value={() => setDbVersion((v) => v + 1)}>
        <Suspense fallback={<ActivityIndicator size="large" color="#905c36" />}>
          <SQLiteProvider
            key={dbVersion}
            databaseName={DATABASE_NAME}
            options={{ enableChangeListener: true }}
            useSuspense
          >
            <MigrationsRunner>
              <AuthProvider>
                <ThemeProvider>
                  <NewRestaurantProvider>
                    <NewDishProvider>
                      <IntentHandler />
                      <SyncRunner />
                      <Slot />
                    </NewDishProvider>
                  </NewRestaurantProvider>
                </ThemeProvider>
              </AuthProvider>
            </MigrationsRunner>
          </SQLiteProvider>
        </Suspense>
      </DBVersionContext.Provider>
    </GestureHandlerRootView>
  );
}
