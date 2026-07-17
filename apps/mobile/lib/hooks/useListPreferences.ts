import { eq, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SortField, SortOrder } from '@/components/FilterSortModal';
import * as schema from '@/services/db/schema';

interface ListPreferences {
  isGridView: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  loaded: boolean;
}

const DEFAULTS: Record<string, { sortField: SortField; sortOrder: SortOrder }> = {
  restaurant: { sortField: 'name', sortOrder: 'asc' },
  dish: { sortField: 'name', sortOrder: 'asc' },
  visit: { sortField: 'date', sortOrder: 'desc' },
};

export function useListPreferences(entityType: 'restaurant' | 'dish' | 'visit') {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const defaults = DEFAULTS[entityType];

  const [prefs, setPrefs] = useState<ListPreferences>({
    isGridView: false,
    sortField: defaults.sortField,
    sortOrder: defaults.sortOrder,
    loaded: false,
  });

  const drizzleRef = useRef(drizzleDb);
  drizzleRef.current = drizzleDb;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await drizzleRef.current
          .select()
          .from(schema.appSettings)
          .where(like(schema.appSettings.key, `${entityType}_%`));

        if (cancelled) return;

        const map = new Map(rows.map((r) => [r.key, r.value]));
        setPrefs({
          isGridView: map.get(`${entityType}_view_mode`) === 'grid',
          sortField: (map.get(`${entityType}_sort_field`) as SortField) || defaults.sortField,
          sortOrder: (map.get(`${entityType}_sort_order`) as SortOrder) || defaults.sortOrder,
          loaded: true,
        });
      } catch {
        if (!cancelled) setPrefs((p) => ({ ...p, loaded: true }));
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, defaults.sortField, defaults.sortOrder]);

  const upsert = useCallback(
    async (key: string, value: string) => {
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
          await drizzleRef.current
            .insert(schema.appSettings)
            .values({ key, value });
        }
      } catch {
        // silent
      }
    },
    [],
  );

  const setIsGridView = useCallback(
    (value: boolean) => {
      setPrefs((p) => ({ ...p, isGridView: value }));
      upsert(`${entityType}_view_mode`, value ? 'grid' : 'list');
    },
    [entityType, upsert],
  );

  const setSortField = useCallback(
    (value: SortField) => {
      setPrefs((p) => ({ ...p, sortField: value }));
      upsert(`${entityType}_sort_field`, value);
    },
    [entityType, upsert],
  );

  const setSortOrder = useCallback(
    (value: SortOrder) => {
      setPrefs((p) => ({ ...p, sortOrder: value }));
      upsert(`${entityType}_sort_order`, value);
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
