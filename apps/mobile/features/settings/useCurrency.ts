import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import * as schema from '@/services/db/schema';
import { getSetting, setSetting } from '@/services/db/settings-repository';

import { detectCurrency, isKnownCurrency } from './currency';

const SETTING_KEY = 'currency';

/*
 * La copia en memoria, compartida por todo el mundo.
 *
 * Mismo motivo que `defaultsStore`: la moneda está en pantalla en dos sitios a
 * la vez —la fila de Ajustes y el detalle de plato—, y con una copia por
 * componente cambiarla en Ajustes dejaba el detalle enseñando la anterior, que
 * se lee como que el ajuste no guardó.
 *
 * Arranca en lo que diga el dispositivo, no en el valor por defecto: así el
 * primer render ya es el correcto para casi todo el mundo, y lo que llegue de
 * disco después solo confirma o corrige.
 */
let currency = detectCurrency();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string {
  return currency;
}

/** Solo para tests: devuelve el módulo a como estaba al arrancar. */
export function resetCurrencyForTests(): void {
  currency = detectCurrency();
  loaded = false;
  listeners.clear();
}

/**
 * La moneda con la que **nacen** los platos nuevos, y cómo cambiarla.
 *
 * Desde 0013 la moneda vive en cada plato; esto es solo el punto de partida.
 * Cambiarlo no toca ni un plato ya escrito, ni siquiera el símbolo con el que se
 * pinta: estando en Europa se deja en euros y lo que se apunte nace en euros; al
 * volver a Colombia se cambia y lo nuevo nace en pesos.
 *
 * Guardada en `app_settings`, igual que las visibilidades por defecto: es una
 * preferencia local que entra en la copia de seguridad y que nadie más necesita
 * saber. **No viaja en el sync**, y ahora eso importa menos que antes — dos
 * móviles de la misma persona pueden estar en países distintos, y lo que cada
 * uno proponga al crear un plato es cosa suya.
 *
 * Ojo con la analogía fácil: **no funciona como la visibilidad por defecto**.
 * Aquella se resuelve al leer, así que cambiarla mueve todo lo que estaba en
 * `default`; ésta se copia al crear. Mover una visibilidad es reversible;
 * reinterpretar un precio en otra moneda es inventárselo.
 */
export function useCurrency(): { currency: string; setCurrency: (next: string) => Promise<void> } {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);

  const value = useSyncExternalStore(subscribe, snapshot);

  useEffect(() => {
    if (loaded) return;
    loaded = true;

    let cancelled = false;
    void (async () => {
      try {
        const stored = await getSetting(db, SETTING_KEY);
        if (!cancelled && stored && isKnownCurrency(stored)) {
          currency = stored;
          emit();
        }
      } catch {
        // Una preferencia que no se puede leer no puede impedir que se abra una
        // pantalla; que lo intente el siguiente montaje.
        loaded = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  const update = useCallback(
    async (next: string) => {
      // Optimista: elegir en una lista no debe esperar a una escritura en disco.
      currency = next;
      emit();
      await setSetting(db, SETTING_KEY, next);
    },
    [db],
  );

  return { currency: value, setCurrency: update };
}
