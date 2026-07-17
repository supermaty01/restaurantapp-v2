import { eq } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { DrizzleDatabase } from '@/services/db/types';

/**
 * Key/value access to the `app_settings` table.
 *
 * Preferences live in SQLite rather than AsyncStorage so that there is a single
 * local source of truth (and one less native dependency — docs/11-dependencias.md).
 */
export async function getSetting(db: DrizzleDatabase, key: string): Promise<string | null> {
  const rows = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .limit(1);

  return rows[0]?.value ?? null;
}

export async function setSetting(db: DrizzleDatabase, key: string, value: string): Promise<void> {
  const updatedAt = new Date().toISOString();

  await db.insert(schema.appSettings).values({ key, value, updatedAt }).onConflictDoUpdate({
    target: schema.appSettings.key,
    set: { value, updatedAt },
  });
}
