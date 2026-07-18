import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '@/services/db/schema';

import { applyMigrations } from './apply-migrations';

import type { AppDatabase } from '@/services/db/types';

/**
 * Builds an in-memory drizzle database (better-sqlite3) with all migrations
 * applied, so repositories can be tested against a real SQLite in node. The
 * cast to AppDatabase is sound: the sync better-sqlite3 driver satisfies the
 * same BaseSQLiteDatabase surface the repositories use.
 */
export function makeTestDb(): { db: AppDatabase; raw: Database.Database } {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  applyMigrations(raw);
  const db = drizzle(raw, { schema }) as unknown as AppDatabase;
  return { db, raw };
}
