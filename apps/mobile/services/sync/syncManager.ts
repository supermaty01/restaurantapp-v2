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
