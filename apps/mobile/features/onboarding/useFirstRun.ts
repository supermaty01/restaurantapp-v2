import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import * as schema from '@/services/db/schema';
import { getSetting, setSetting } from '@/services/db/settings-repository';

const SETTING_KEY = 'welcome_seen';

/**
 * Si esta es la primera vez que se abre la app.
 *
 * La marca vive en `app_settings`, con el resto de preferencias, y eso decide
 * dos cosas por sí solo: entra en la copia de seguridad —restaurar un diario en
 * un móvil nuevo no vuelve a dar la bienvenida a alguien que lleva un año
 * usando esto— y desaparece al borrar los datos de la app, que es cuando de
 * verdad vuelve a ser la primera vez.
 *
 * `null` mientras se lee. Es importante que no sea `true`: con un valor
 * optimista, cada arranque enseñaría un fotograma de la bienvenida antes de
 * corregirse, y esa clase de parpadeo es peor que esperar un instante.
 */
export function useFirstRun(): { firstRun: boolean | null; markSeen: () => Promise<void> } {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);

  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const seen = await getSetting(db, SETTING_KEY);
        if (!cancelled) setFirstRun(seen !== 'true');
      } catch {
        // Una preferencia ilegible no puede dejar a nadie fuera de su diario:
        // ante la duda, se entra.
        if (!cancelled) setFirstRun(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const markSeen = useCallback(async () => {
    // Optimista: quien ha tocado un botón ya ha decidido, y hacerle esperar a
    // una escritura en disco para pasar de pantalla no aporta nada.
    setFirstRun(false);
    await setSetting(db, SETTING_KEY, 'true');
  }, [db]);

  return { firstRun, markSeen };
}
