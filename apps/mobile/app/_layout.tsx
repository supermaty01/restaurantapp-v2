import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Slot } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { Suspense, useState, createContext, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IntentHandler } from '@/components/IntentHandler';
import migrations from '@/drizzle/migrations';
import '../global.css';
import { NewDishProvider } from '@/lib/context/NewDishContext';
import { NewRestaurantProvider } from '@/lib/context/NewRestaurantContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { ensureAppDirectories } from '@/lib/helpers/directory-setup';
import { DATABASE_NAME } from '@/services/db/constants';
// Contexto para exponer la función que “bump” la versión de la BBDD
export const DBVersionContext = createContext<() => void>(() => {});

/**
 * Componente interno que ejecuta las migraciones en el contexto de SQLiteProvider
 */
function MigrationsRunner({ children }: { children: React.ReactNode }) {
  const sqliteDb = useSQLiteContext();
  const db = drizzle(sqliteDb);
  useMigrations(db, migrations);
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
              <ThemeProvider>
                <NewRestaurantProvider>
                  <NewDishProvider>
                    <IntentHandler />
                    <Slot />
                  </NewDishProvider>
                </NewRestaurantProvider>
              </ThemeProvider>
            </MigrationsRunner>
          </SQLiteProvider>
        </Suspense>
      </DBVersionContext.Provider>
    </GestureHandlerRootView>
  );
}
