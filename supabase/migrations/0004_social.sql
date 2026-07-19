-- Social layer (docs/06): friendships, friend read access, and the feed.
-- Verify with `supabase db reset` (docs/13).

-- ── Friendships ──────────────────────────────────────────────────────────────
-- One row per pair, stored in canonical order (user_a < user_b) so a pair is
-- unique regardless of who requested.
create table if not exists friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

alter table friendships enable row level security;

-- A user sees and manages only friendships they are part of.
create policy friendships_member on friendships
  for all
  using (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b));

-- Are two users accepted friends? Used by the friend-read policies below.
create or replace function are_friends(u1 uuid, u2 uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and user_a = least(u1, u2)
      and user_b = greatest(u1, u2)
  );
$$;

-- ── Friend read access to shared content ─────────────────────────────────────
-- Friends may read rows a user marked friends/public. Owner access (from
-- 0002) still applies for the user's own rows.
do $$
declare
  t text;
begin
  foreach t in array array['restaurants', 'dishes', 'visits'] loop
    execute format(
      'create policy %I on %I for select using (' ||
      'visibility in (''friends'', ''public'') and are_friends(auth.uid(), user_id))',
      t || '_friend_read', t
    );
  end loop;
end;
$$;

-- ── Feed ─────────────────────────────────────────────────────────────────────
-- The feed is a query, not a materialized system (docs/06): a friend's recent
-- shareable activity. RLS on the base tables already scopes visibility, so this
-- view simply unions the activity streams.
create or replace view feed as
  select 'visit' as kind, uuid as entity_uuid, user_id, created_at, updated_at
    from visits
    where deleted = false and visibility in ('friends', 'public')
  union all
  select 'dish' as kind, uuid, user_id, created_at, updated_at
    from dishes
    where deleted = false and visibility in ('friends', 'public')
  union all
  select 'restaurant' as kind, uuid, user_id, created_at, updated_at
    from restaurants
    where deleted = false and visibility in ('friends', 'public');
