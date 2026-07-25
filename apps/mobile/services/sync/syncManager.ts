import { getDefaults } from '@/features/privacy/defaultsStore';
import { pushVisibilityDefaults } from '@/features/social/api';
import type { AppDatabase } from '@/services/db/types';
import { SyncEngine } from '@/services/sync/engine';
import { createSupabaseTransport } from '@/services/sync/supabaseTransport';

export interface SyncOutcome {
  ok: boolean;
  error: string | null;
  at: string;
}

/**
 * One sync pass against Supabase. Never throws — a sync failure must never break
 * the app (docs/03); it reports the outcome so the UI can show it.
 */
export async function runSync(db: AppDatabase, accountUuid: string): Promise<SyncOutcome> {
  const engine = new SyncEngine(db, createSupabaseTransport(accountUuid), accountUuid);
  try {
    // Before the rows, because every row stored as `default` is meaningless to
    // the server until it knows what this account's default *is*. Pushing them
    // afterwards would leave a window where a friend sees nothing.
    await pushVisibilityDefaults(getDefaults());
    await engine.sync();
    return { ok: true, error: null, at: new Date().toISOString() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error de sincronización',
      at: new Date().toISOString(),
    };
  }
}
