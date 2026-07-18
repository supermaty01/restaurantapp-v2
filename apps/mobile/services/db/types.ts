import type * as schema from './schema';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { drizzle } from 'drizzle-orm/expo-sqlite';

export type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Driver-agnostic DB type accepted by the repositories. Both the app's
 * expo-sqlite driver (async) and the better-sqlite3 driver used in node tests
 * (sync) satisfy it, so repositories can be tested against a real database.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;
