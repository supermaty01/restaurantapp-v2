import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import * as SystemUI from 'expo-system-ui';
import { colorScheme } from 'nativewind';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from '@/lib/design/tokens';
import type { ThemeColors } from '@/lib/design/tokens';
import * as schema from '@/services/db/schema';
import { getSetting, setSetting } from '@/services/db/settings-repository';

const THEME_MODE_KEY = 'themeMode';

const THEME_MODES = ['light', 'dark', 'system'] as const;
type ThemeMode = (typeof THEME_MODES)[number];

function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

interface ThemeContextData {
  themeMode: ThemeMode;
  isDarkMode: boolean;
  /**
   * Raw colour values, for props that take a colour string — icons, StatusBar,
   * map styling. Anything styled with className should use the semantic classes
   * (`bg-surface`, `text-ink`) instead, which already follow the scheme.
   */
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextData>({
  themeMode: 'system',
  isDarkMode: false,
  colors: lightColors,
  setThemeMode: async () => {},
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const sqliteDb = useSQLiteContext();
  const db = useMemo(() => drizzle(sqliteDb, { schema }), [sqliteDb]);

  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const systemColorScheme = useColorScheme();

  const isDarkMode = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';

  // NativeWind keeps its own notion of the scheme, and that is what resolves
  // the CSS variables behind every class. Without this the in-app light/dark
  // setting moved only the values read from `colors` — picking "dark" on a
  // phone set to light produced a half-dark screen.
  useEffect(() => {
    colorScheme.set(themeMode);
  }, [themeMode]);

  /*
   * El fondo de la ventana nativa, debajo de todo lo que dibuja React.
   *
   * Se ve en los huecos: entre la pantalla de arranque y el primer fotograma,
   * al rebotar el scroll, y detrás de las transiciones de pantalla. Android lo
   * pinta blanco si no se dice, así que en modo oscuro cada uno de esos huecos
   * era un destello. La pantalla de arranque ya trae su par claro/oscuro en
   * `app.config.js`; esto es la continuación en ejecución, y además sigue al
   * ajuste de la app y no solo al del sistema.
   */
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(
      isDarkMode ? darkColors.canvas : lightColors.canvas,
    ).catch(() => {
      // Cosmético: si la plataforma no lo soporta, no hay nada que reparar.
    });
  }, [isDarkMode]);

  useEffect(() => {
    let cancelled = false;

    const loadThemePreference = async () => {
      try {
        const savedMode = await getSetting(db, THEME_MODE_KEY);
        if (!cancelled && savedMode && isThemeMode(savedMode)) {
          setThemeModeState(savedMode);
        }
      } catch (error) {
        // A missing preference must never keep the app from rendering.
        console.error('Error loading theme preference:', error);
      }
    };

    void loadThemePreference();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      // Applied optimistically: the UI should not wait on a disk write.
      setThemeModeState(mode);
      try {
        await setSetting(db, THEME_MODE_KEY, mode);
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    },
    [db],
  );

  const value = useMemo(
    () => ({
      themeMode,
      isDarkMode,
      colors: isDarkMode ? darkColors : lightColors,
      setThemeMode,
    }),
    [themeMode, isDarkMode, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => React.useContext(ThemeContext);
