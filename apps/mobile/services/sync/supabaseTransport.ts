import { requireSupabase } from '@/services/supabase/client';
import type { LinkRow, RemoteRecord, SyncTransport } from '@/services/sync/transport';

/**
 * Real SyncTransport over supabase-js (docs/03). push upserts (the server's
 * reject_older_update trigger enforces LWW); pull reads rows changed after the
 * cursor. Untested here — it needs a live Supabase (verify per docs/13); the
 * engine's logic is covered against the fake.
 *
 * Takes the account uuid because **RLS is not a filter**. It says what you are
 * allowed to read, and you are allowed to read a friend's shared visit — so an
 * unfiltered `select *` pulled other people's rows straight into the local
 * diary. Two things went wrong at once: the diary stopped being only what you
 * wrote, and the next push stamped those rows with *your* uuid and upserted
 * them onto their owner's, which the owner policy rejected and which killed the
 * entire push with
 *
 *     new row violates row-level security policy (USING expression)
 *
 * Other people's data reaches the app through the social RPCs, which return it
 * as something to look at. It never enters the tables the diary is made of.
 */
export function createSupabaseTransport(accountUuid: string): SyncTransport {
  return {
    async push(table, records) {
      if (records.length === 0) return;
      const { error } = await requireSupabase().from(table).upsert(records, { onConflict: 'uuid' });
      if (error) throw new Error(`push ${table}: ${error.message}`);
    },

    async pull(table, since, limit) {
      // Por `sync_seq` y no por `updated_at`: el segundo lo pone el móvil que
      // escribió, así que con dos dispositivos y los relojes desfasados había
      // filas que no se bajaban nunca. Ver 0017.
      let query = requireSupabase()
        .from(table)
        .select('*')
        .eq('user_id', accountUuid)
        .order('sync_seq', { ascending: true })
        .limit(limit);

      if (since !== null) query = query.gt('sync_seq', since);

      const { data, error } = await query;
      if (error) throw new Error(`pull ${table}: ${error.message}`);
      return (data ?? []) as RemoteRecord[];
    },

    async counts() {
      const response = (await requireSupabase().rpc('sync_counts')) as {
        data: { table_name: string; rows: number }[] | null;
        error: { message: string } | null;
      };
      if (response.error) throw new Error(`counts: ${response.error.message}`);

      const totals: Record<string, number> = {};
      for (const row of response.data ?? []) {
        totals[row.table_name] = Number(row.rows ?? 0);
      }
      return totals;
    },

    async replaceLinks(table, parentColumn, parentUuids, rows) {
      if (parentUuids.length === 0) return;

      // Delete first, unconditionally. Upserting the incoming rows would leave
      // behind the links the app removed — the whole point of replacing is that
      // a junction row has no tombstone to announce its own deletion.
      const { error: deleteError } = await requireSupabase()
        .from(table)
        .delete()
        .eq('user_id', accountUuid)
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
        .eq('user_id', accountUuid)
        .in(parentColumn, parentUuids);
      if (error) throw new Error(`pullLinks ${table}: ${error.message}`);
      return (data ?? []) as LinkRow[];
    },
  };
}
