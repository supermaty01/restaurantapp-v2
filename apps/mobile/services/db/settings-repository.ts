import { eq } from 'drizzle-orm';

import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';

/**
 * Key/value access to the `app_settings` table.
 *
 * Preferences live in SQLite rather than AsyncStorage so that there is a single
 * local source of truth (and one less native dependency — docs/11-dependencias.md).
 *
 * `AppDatabase` y no `DrizzleDatabase`: esto no usa nada de expo-sqlite, y con
 * el tipo estrecho cualquier sitio que reciba la base agnóstica —que son casi
 * todos, para poder probarse en node— tenía que hacer un cast para leer una
 * preferencia.
 */
export async function getSetting(db: AppDatabase, key: string): Promise<string | null> {
  const rows = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .limit(1);

  return rows[0]?.value ?? null;
}

export async function setSetting(db: AppDatabase, key: string, value: string): Promise<void> {
  const updatedAt = new Date().toISOString();

  await db.insert(schema.appSettings).values({ key, value, updatedAt }).onConflictDoUpdate({
    target: schema.appSettings.key,
    set: { value, updatedAt },
  });
}
