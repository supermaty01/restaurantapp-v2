import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

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
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextData>({
  themeMode: 'system',
  isDarkMode: false,
  setThemeMode: async () => {},
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const sqliteDb = useSQLiteContext();
  const db = useMemo(() => drizzle(sqliteDb), [sqliteDb]);

  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const systemColorScheme = useColorScheme();

  const isDarkMode = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';

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
    () => ({ themeMode, isDarkMode, setThemeMode }),
    [themeMode, isDarkMode, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => React.useContext(ThemeContext);
