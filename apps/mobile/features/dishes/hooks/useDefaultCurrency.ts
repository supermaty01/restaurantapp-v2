import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import * as schema from '@/services/db/schema';
import { getSetting, setSetting } from '@/services/db/settings-repository';
import type { AppDatabase } from '@/services/db/types';

import { FALLBACK_CURRENCY, isCurrencyCode } from '../currency';

/**
 * La moneda que se propone al escribir un precio nuevo.
 *
 * Es un ajuste con un papel muy concreto, y **no** el mismo que el de
 * visibilidad: aquel se guarda sin resolver (`default`) y sigue al ajuste toda
 * la vida de la entrada; este se copia en el plato al guardarlo. Tiene que ser
 * así porque cambiar de país es normal y reescribir lo que pagaste el mes pasado
 * no lo es. Estando un mes en Europa se deja en euros, se vuelve a Colombia y se
 * pone en pesos, y cada plato conserva la suya.
 *
 * Vive en `app_settings`, como el resto de preferencias: local al dispositivo y
 * dentro de la copia de seguridad.
 */
export const DEFAULT_CURRENCY_KEY = 'defaultCurrency';

let current = FALLBACK_CURRENCY;
let loaded = false;
const listeners = new Set<() => void>();

function publish(next: string) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * La moneda por defecto, fuera de React.
 *
 * Los formularios la leen desde el hook; esto existe para los sitios que
 * escriben un plato sin haber montado uno (importaciones, atajos).
 */
export function getDefaultCurrency(): string {
  return current;
}

export async function ensureDefaultCurrencyLoaded(db: AppDatabase): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const stored = await getSetting(db, DEFAULT_CURRENCY_KEY);
    if (stored && isCurrencyCode(stored)) publish(stored);
  } catch {
    // Que no se pueda leer no puede impedir abrir un formulario; se reintenta.
    loaded = false;
  }
}

/** Test-only: olvida lo leído entre casos. */
export function resetDefaultCurrency(): void {
  loaded = false;
  publish(FALLBACK_CURRENCY);
}

export function useDefaultCurrency() {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);

  const value = useSyncExternalStore(subscribe, getDefaultCurrency);

  useEffect(() => {
    void ensureDefaultCurrencyLoaded(db);
  }, [db]);

  const update = useCallback(
    async (next: string) => {
      if (!isCurrencyCode(next)) return;
      // Optimista: un ajuste no debe esperar a una escritura en disco.
      publish(next);
      try {
        await setSetting(db, DEFAULT_CURRENCY_KEY, next);
      } catch (error) {
        console.error('No se pudo guardar la moneda por defecto:', error);
      }
    },
    [db],
  );

  return { value, update };
}
