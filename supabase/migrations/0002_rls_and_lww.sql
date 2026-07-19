-- Row Level Security + last-write-wins guard (docs/03).
--
-- Every table is owner-scoped: a user reads/writes only their own rows. Friend
-- read access (visibility in friends/public) arrives with the social schema in
-- phase 5. NOTE: verify with `supabase db reset` (docs/13).

-- ── LWW guard ────────────────────────────────────────────────────────────────
-- On conflict the client upserts with plain supabase-js; this trigger drops the
-- write when the incoming row is older than what's stored, so a slow device
-- can't clobber a newer edit from another device.
create or replace function reject_older_update()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- skip the update, keep the newer stored row
  end if;
  return new;
end;
$$;

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- Applies owner RLS + the LWW trigger to a data table.
do $$
declare
  t text;
  data_tables text[] := array[
    'restaurants', 'tags', 'dishes', 'visits', 'people', 'images'
  ];
  junction_tables text[] := array[
    'restaurant_tag', 'dish_tag', 'dish_visit', 'visit_participant'
  ];
begin
  -- Data tables: owner RLS + LWW trigger on update.
  foreach t in array data_tables loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t
    );
    execute format(
      'create trigger %I before update on %I for each row execute function reject_older_update()',
      t || '_lww', t
    );
  end loop;

  -- Junctions: owner RLS (no updated_at, so no LWW trigger).
  foreach t in array junction_tables loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t
    );
  end loop;
end;
$$;

-- ── Profiles ─────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

-- A profile row is writable only by its owner.
create policy profiles_owner_write on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Profiles are readable by any authenticated user (needed to search/add friends;
-- only username/display_name/avatar are exposed — see docs/06).
create policy profiles_public_read on profiles
  for select using (auth.role() = 'authenticated');
