import { eq, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SortField, SortOrder } from '@/components/filters/FilterSheet';
import * as schema from '@/services/db/schema';

interface ListPreferences {
  isGridView: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  loaded: boolean;
}

type ListEntityType = 'restaurant' | 'dish' | 'visit';

// Keyed by the exact union rather than `string`, so indexing is provably safe.
const DEFAULTS: Record<
  ListEntityType,
  { sortField: SortField; sortOrder: SortOrder; isGridView: boolean }
> = {
  restaurant: { sortField: 'name', sortOrder: 'asc', isGridView: false },
  dish: { sortField: 'name', sortOrder: 'asc', isGridView: false },
  // Visits open as the month timeline: a flat reverse-chronological list of a
  // few hundred entries gives no sense of *when* (docs/14).
  visit: { sortField: 'date', sortOrder: 'desc', isGridView: true },
};

export function useListPreferences(entityType: ListEntityType) {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const defaults = DEFAULTS[entityType];

  const [prefs, setPrefs] = useState<ListPreferences>({
    isGridView: defaults.isGridView,
    sortField: defaults.sortField,
    sortOrder: defaults.sortOrder,
    loaded: false,
  });

  const drizzleRef = useRef(drizzleDb);
  drizzleRef.current = drizzleDb;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await drizzleRef.current
          .select()
          .from(schema.appSettings)
          .where(like(schema.appSettings.key, `${entityType}_%`));

        if (cancelled) return;

        const map = new Map(rows.map((r) => [r.key, r.value]));
        setPrefs({
          // A stored preference wins; otherwise the entity's own default,
          // which is the month timeline for visits (docs/14).
          isGridView: map.has(`${entityType}_view_mode`)
            ? map.get(`${entityType}_view_mode`) === 'grid'
            : defaults.isGridView,
          sortField: (map.get(`${entityType}_sort_field`) as SortField) || defaults.sortField,
          sortOrder: (map.get(`${entityType}_sort_order`) as SortOrder) || defaults.sortOrder,
          loaded: true,
        });
      } catch {
        if (!cancelled) setPrefs((p) => ({ ...p, loaded: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, defaults.sortField, defaults.sortOrder]);

  const upsert = useCallback(async (key: string, value: string) => {
    try {
      const existing = await drizzleRef.current
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.key, key));

      if (existing.length > 0) {
        await drizzleRef.current
          .update(schema.appSettings)
          .set({ value })
          .where(eq(schema.appSettings.key, key));
      } else {
        await drizzleRef.current.insert(schema.appSettings).values({ key, value });
      }
    } catch {
      // silent
    }
  }, []);

  const setIsGridView = useCallback(
    (value: boolean) => {
      setPrefs((p) => ({ ...p, isGridView: value }));
      void upsert(`${entityType}_view_mode`, value ? 'grid' : 'list');
    },
    [entityType, upsert],
  );

  const setSortField = useCallback(
    (value: SortField) => {
      setPrefs((p) => ({ ...p, sortField: value }));
      void upsert(`${entityType}_sort_field`, value);
    },
    [entityType, upsert],
  );

  const setSortOrder = useCallback(
    (value: SortOrder) => {
      setPrefs((p) => ({ ...p, sortOrder: value }));
      void upsert(`${entityType}_sort_order`, value);
    },
    [entityType, upsert],
  );

  return {
    ...prefs,
    setIsGridView,
    setSortField,
    setSortOrder,
  };
}
