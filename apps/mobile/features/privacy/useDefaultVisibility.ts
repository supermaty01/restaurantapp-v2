import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState, useMemo } from 'react';

import * as schema from '@/services/db/schema';
import { getSetting, setSetting } from '@/services/db/settings-repository';

import {
  FALLBACK_VISIBILITY,
  defaultVisibilityKey,
  isVisibility,
  type ShareableEntity,
  type Visibility,
} from './visibility';

/**
 * The visibility a new entry starts with, per kind.
 *
 * Kept as a preference rather than asked every time: "who sees my dishes" is a
 * decision you make once and change rarely, while "share *this* meal" is a
 * decision you make per meal. Conflating the two is what turns a privacy
 * control into a chore, so the form starts from this and lets you override it.
 *
 * Stored in `app_settings`, which means it is local to the device and included
 * in a backup — it is a preference, not something other people need to know.
 */
export function useDefaultVisibility(entity: ShareableEntity) {
  // settings-repository takes the drizzle handle, not the app-wide AppDatabase
  // alias, which is widened to allow the async node driver in tests.
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);
  const [value, setValue] = useState<Visibility>(FALLBACK_VISIBILITY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await getSetting(db, defaultVisibilityKey(entity));
        if (!cancelled && stored && isVisibility(stored)) setValue(stored);
      } catch {
        // A missing preference must never keep a form from opening.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, entity]);

  const update = useCallback(
    async (next: Visibility) => {
      // Applied optimistically: a toggle should not wait on a disk write.
      setValue(next);
      try {
        await setSetting(db, defaultVisibilityKey(entity), next);
      } catch (error) {
        console.error('No se pudo guardar la visibilidad por defecto:', error);
      }
    },
    [db, entity],
  );

  return { value, loaded, update };
}
