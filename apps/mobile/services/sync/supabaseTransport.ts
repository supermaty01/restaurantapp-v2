import { requireSupabase } from '@/services/supabase/client';
import type { LinkRow, RemoteRecord, SyncTransport } from '@/services/sync/transport';

/**
 * Real SyncTransport over supabase-js (docs/03). push upserts (the server's
 * reject_older_update trigger enforces LWW); pull reads rows changed after the
 * cursor, RLS scoping them to the account. Untested here — it needs a live
 * Supabase (verify per docs/13); the engine's logic is covered against the fake.
 */
export function createSupabaseTransport(): SyncTransport {
  return {
    async push(table, records) {
      if (records.length === 0) return;
      const { error } = await requireSupabase().from(table).upsert(records, { onConflict: 'uuid' });
      if (error) throw new Error(`push ${table}: ${error.message}`);
    },

    async pull(table, since) {
      let query = requireSupabase()
        .from(table)
        .select('*')
        .order('updated_at', { ascending: true });

      if (since) query = query.gt('updated_at', since);

      const { data, error } = await query;
      if (error) throw new Error(`pull ${table}: ${error.message}`);
      return (data ?? []) as RemoteRecord[];
    },

    async replaceLinks(table, parentColumn, parentUuids, rows) {
      if (parentUuids.length === 0) return;

      // Delete first, unconditionally. Upserting the incoming rows would leave
      // behind the links the app removed — the whole point of replacing is that
      // a junction row has no tombstone to announce its own deletion.
      const { error: deleteError } = await requireSupabase()
        .from(table)
        .delete()
        .in(parentColumn, parentUuids);
      if (deleteError) throw new Error(`replaceLinks ${table}: ${deleteError.message}`);

      if (rows.length === 0) return;
      const { error } = await requireSupabase().from(table).insert(rows);
      if (error) throw new Error(`replaceLinks ${table}: ${error.message}`);
    },

    async pullLinks(table, parentColumn, parentUuids) {
      if (parentUuids.length === 0) return [];

      const { data, error } = await requireSupabase()
        .from(table)
        .select('*')
        .in(parentColumn, parentUuids);
      if (error) throw new Error(`pullLinks ${table}: ${error.message}`);
      return (data ?? []) as LinkRow[];
    },
  };
}
