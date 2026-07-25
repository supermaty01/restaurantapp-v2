import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

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
 * One copy of the preferences, shared by everything that reads them.
 *
 * Module level rather than per-hook `useState`, because the same preference is
 * on screen in more than one place at once — the settings row and the sheet
 * that edits it. With separate state, changing it in the sheet left the row
 * showing the old value, which reads as "the setting did not save". Same shape
 * as `syncStore`, and the same reason.
 */
type Defaults = Record<ShareableEntity, Visibility>;

function blank(): Defaults {
  return {
    restaurant: FALLBACK_VISIBILITY,
    dish: FALLBACK_VISIBILITY,
    visit: FALLBACK_VISIBILITY,
  };
}

let defaults: Defaults = blank();
const listeners = new Set<() => void>();

/** Entities already read from disk, so each is loaded once per launch. */
const loaded = new Set<ShareableEntity>();

function emit(next: Defaults): void {
  defaults = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: forgets everything between cases. */
export function resetDefaultVisibility(): void {
  loaded.clear();
  emit(blank());
}

/**
 * The visibility a new entry starts with, per kind.
 *
 * Kept as a preference rather than asked every time: "who sees my dishes" is a
 * decision you make once and change rarely, while "share *this* meal" is a
 * decision you make per meal. Conflating the two is what turns a privacy
 * control into a chore, so the form starts from this and lets you override it.
 *
 * Stored in `app_settings`: local to the device and included in a backup, which
 * is right for a preference nobody else needs to know.
 */
export function useDefaultVisibility(entity: ShareableEntity) {
  // settings-repository takes the drizzle handle, not the app-wide AppDatabase
  // alias, which is widened to allow the async node driver used in tests.
  const sqlite = useSQLiteContext();
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite]);

  const all = useSyncExternalStore(subscribe, () => defaults);

  useEffect(() => {
    if (loaded.has(entity)) return;
    loaded.add(entity);

    let cancelled = false;
    void (async () => {
      try {
        const stored = await getSetting(db, defaultVisibilityKey(entity));
        if (!cancelled && stored && isVisibility(stored)) {
          emit({ ...defaults, [entity]: stored });
        }
      } catch {
        // A missing preference must never keep a form from opening; allow a
        // later mount to try again.
        loaded.delete(entity);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, entity]);

  const update = useCallback(
    async (next: Visibility) => {
      // Applied optimistically: a toggle should not wait on a disk write.
      emit({ ...defaults, [entity]: next });
      try {
        await setSetting(db, defaultVisibilityKey(entity), next);
      } catch (error) {
        console.error('No se pudo guardar la visibilidad por defecto:', error);
      }
    },
    [db, entity],
  );

  return { value: all[entity], loaded: loaded.has(entity), update };
}
