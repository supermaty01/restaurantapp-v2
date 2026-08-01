import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import * as schema from '@/services/db/schema';
import { setSetting } from '@/services/db/settings-repository';

import { getDefaults, isLoaded, setDefaults, subscribeToDefaults } from './defaultsStore';
import { ensureDefaultsLoaded } from './loadDefaults';
import { defaultVisibilityKey, type ExplicitVisibility, type ShareableEntity } from './visibility';

/**
 * The visibility a new entry starts with, per kind.
 *
 * Kept as a preference rather than asked every time: "who sees my dishes" is a
 * decision you make once and change rarely, while "share *this* meal" is a
 * decision you make per meal. Conflating the two is what turns a privacy
 * control into a chore, so the form starts from this and lets you override it.
 *
 * Stored in `app_settings`: local to the device and included in a backup, which
 * is right for a preference nobody else needs to know. The in-memory copy lives
 * in `defaultsStore`, which the sync push also reads.
 */
export function useDefaultVisibility(entity: ShareableEntity) {
  // settings-repository takes the drizzle handle, not the app-wide AppDatabase
  // alias, which is widened to allow the async node driver used in tests.
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);

  const all = useSyncExternalStore(subscribeToDefaults, getDefaults);

  // La lectura la hace `ensureDefaultsLoaded`, que es la misma que espera el
  // sync antes de publicarlos. Dos lectores distintos del mismo dato es
  // exactamente como el almacén acabó publicándose en blanco: este hook llenaba
  // una entrada por montaje y el sync leía las tres, arrancara quien arrancara
  // primero.
  useEffect(() => {
    void ensureDefaultsLoaded(db);
  }, [db]);

  const update = useCallback(
    async (next: ExplicitVisibility) => {
      // Applied optimistically: a toggle should not wait on a disk write.
      setDefaults({ ...getDefaults(), [entity]: next });
      try {
        await setSetting(db, defaultVisibilityKey(entity), next);
      } catch (error) {
        console.error('No se pudo guardar la visibilidad por defecto:', error);
      }
    },
    [db, entity],
  );

  return { value: all[entity], loaded: isLoaded(entity), update };
}
