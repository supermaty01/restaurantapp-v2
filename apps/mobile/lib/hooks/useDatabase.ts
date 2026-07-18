import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';

/**
 * The drizzle handle for the app database. Screens use this instead of building
 * their own drizzle instance (which would force them to import the schema and
 * breach the "no DB access in screens" boundary — docs/12). Reads go through
 * feature hooks; writes through feature repositories.
 */
export function useDatabase(): AppDatabase {
  const sqlite = useSQLiteContext();
  return useMemo(() => drizzle(sqlite, { schema }) as unknown as AppDatabase, [sqlite]);
}
