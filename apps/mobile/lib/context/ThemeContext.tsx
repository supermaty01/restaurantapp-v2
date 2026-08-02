import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { colorScheme, vars } from 'nativewind';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import {
  DEFAULT_PALETTE,
  PALETTES,
  isPaletteId,
  paletteVars,
  type PaletteId,
  type ThemeColors,
} from '@/lib/design/tokens';
import * as schema from '@/services/db/schema';
import { getSetting, setSetting } from '@/services/db/settings-repository';

const THEME_MODE_KEY = 'themeMode';
const THEME_PALETTE_KEY = 'themePalette';

const THEME_MODES = ['light', 'dark', 'system'] as const;
type ThemeMode = (typeof THEME_MODES)[number];

function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

interface ThemeContextData {
  themeMode: ThemeMode;
  isDarkMode: boolean;
  /** Qué paleta está elegida. Ver `PALETTES` en `tokens.ts`. */
  palette: PaletteId;
  /**
   * Raw colour values, for props that take a colour string — icons, StatusBar,
   * map styling. Anything styled with className should use the semantic classes
   * (`bg-surface`, `text-ink`) instead, which already follow the scheme.
   */
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setPalette: (palette: PaletteId) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextData>({
  themeMode: 'system',
  isDarkMode: false,
  palette: DEFAULT_PALETTE,
  colors: PALETTES[DEFAULT_PALETTE].light,
  setThemeMode: async () => {},
  setPalette: async () => {},
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * El tema: claro/oscuro, y desde ahora también **qué paleta**.
 *
 * ## Cómo llega el color a las clases
 *
 * `global.css` declara la paleta verde como variables CSS, y no puede declarar
 * las otras siete: Tailwind lo compila una vez, antes de que exista ninguna
 * elección. Lo que hace que las demás funcionen es `vars()` de NativeWind, que
 * **redefine esas mismas variables** sobre una vista — y como cada clase de
 * color resuelve por su variable (`bg-surface` → `rgb(var(--color-surface))`),
 * no hay que tocar ni una clase de la app.
 *
 * Por eso el proveedor pinta una `View` y no solo un contexto: las variables
 * necesitan un nodo del árbol donde vivir. Va con `flex-1` y el color de fondo,
 * o el lienzo se vería blanco entre pantallas.
 *
 * Las dos vías tienen que decir lo mismo: la vista inyecta los valores para las
 * clases, y `colors` los entrega a las props que piden una cadena de color
 * (iconos, `StatusBar`, el mapa). Salen del mismo objeto a propósito.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const sqliteDb = useSQLiteContext();
  const db = useMemo(() => drizzle(sqliteDb, { schema }), [sqliteDb]);

  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
  const systemColorScheme = useColorScheme();

  const isDarkMode = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';

  // NativeWind keeps its own notion of the scheme, and that is what resolves
  // the CSS variables behind every class. Without this the in-app light/dark
  // setting moved only the values read from `colors` — picking "dark" on a
  // phone set to light produced a half-dark screen.
  useEffect(() => {
    colorScheme.set(themeMode);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;

    const loadThemePreference = async () => {
      try {
        const [savedMode, savedPalette] = await Promise.all([
          getSetting(db, THEME_MODE_KEY),
          getSetting(db, THEME_PALETTE_KEY),
        ]);
        if (cancelled) return;
        if (savedMode && isThemeMode(savedMode)) setThemeModeState(savedMode);
        if (savedPalette && isPaletteId(savedPalette)) setPaletteState(savedPalette);
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

  const setPalette = useCallback(
    async (next: PaletteId) => {
      setPaletteState(next);
      try {
        await setSetting(db, THEME_PALETTE_KEY, next);
      } catch (error) {
        console.error('Error saving palette preference:', error);
      }
    },
    [db],
  );

  const colors = useMemo(
    () => (isDarkMode ? PALETTES[palette].dark : PALETTES[palette].light),
    [palette, isDarkMode],
  );

  const value = useMemo(
    () => ({ themeMode, isDarkMode, palette, colors, setThemeMode, setPalette }),
    [themeMode, isDarkMode, palette, colors, setThemeMode, setPalette],
  );

  /*
   * Memorizado, y no por ahorrar unas divisiones.
   *
   * `vars()` no devuelve los valores: devuelve un objeto **vacío** y registra
   * los valores contra esa referencia en un `WeakMap` interno. O sea que la
   * referencia *es* el estilo. Llamarlo en cada render crea un objeto nuevo cada
   * vez, así que NativeWind ve un estilo distinto y vuelve a resolver el árbol
   * entero por debajo aunque no haya cambiado ni un color.
   *
   * Por lo mismo va en un array y no esparcido: `{...vars(…)}` copiaría las
   * claves de un objeto que no tiene ninguna, y el tema se quedaría en el verde
   * de `global.css` sin que fallara nada.
   */
  const themeVars = useMemo(() => vars(paletteVars(colors)), [colors]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: colors.canvas }, themeVars]}>{children}</View>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => React.useContext(ThemeContext);
