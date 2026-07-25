import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import * as schema from '@/services/db/schema';
import { getSetting, setSetting } from '@/services/db/settings-repository';

import {
  getDefaults,
  isLoaded,
  markLoaded,
  setDefaults,
  subscribeToDefaults,
  unmarkLoaded,
} from './defaultsStore';
import {
  defaultVisibilityKey,
  isExplicit,
  isVisibility,
  type ExplicitVisibility,
  type ShareableEntity,
} from './visibility';

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

  useEffect(() => {
    if (isLoaded(entity)) return;
    markLoaded(entity);

    let cancelled = false;
    void (async () => {
      try {
        const stored = await getSetting(db, defaultVisibilityKey(entity));
        if (!cancelled && stored && isVisibility(stored) && isExplicit(stored)) {
          setDefaults({ ...getDefaults(), [entity]: stored });
        }
      } catch {
        // A missing preference must never keep a form from opening; allow a
        // later mount to try again.
        unmarkLoaded(entity);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, entity]);

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
