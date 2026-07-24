-- Makes the profiles table from 0001 actually usable, and closes a leak in the
-- 0004 feed view. Verify with `supabase db reset` (docs/13).
--
-- 0001 created `profiles` and 0002 gave it RLS, but nothing ever inserted a
-- row: signing up left the table empty, so no user could be found by any other
-- user and the whole friend system had nothing to search. This adds the signup
-- trigger, the uniqueness and lookup guarantees a username needs, and an RPC to
-- recover a profile that was never created.

-- ── Username rules ───────────────────────────────────────────────────────────
-- Picks a free username from a seed, de-duplicating with a numeric suffix.
create or replace function claim_username(seed text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  -- Strip anything the shape constraint would reject, then pad short handles.
  base := left(regexp_replace(lower(coalesce(seed, '')), '[^a-z0-9_.]', '', 'g'), 24);
  if length(base) < 3 then
    base := 'user' || substr(md5(random()::text), 1, 6);
  end if;

  candidate := base;
  while exists (select 1 from profiles where lower(username) = candidate) loop
    suffix := suffix + 1;
    candidate := left(base, 24) || suffix::text;
  end loop;

  return candidate;
end;
$$;

-- ── Backfill, then constrain ─────────────────────────────────────────────────
-- Anyone who signed up before this migration has no profile at all.
insert into profiles (user_id, username, display_name, avatar_url)
select
  u.id,
  claim_username(split_part(coalesce(u.email, ''), '@', 1)),
  nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ''),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where not exists (select 1 from profiles p where p.user_id = u.id);

-- Normalise anything that predates the shape rule, so adding the constraint
-- below cannot fail on existing data.
update profiles
set username = claim_username(username)
where username !~ '^[a-z0-9_.]{3,30}$';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_shape'
  ) then
    alter table profiles
      add constraint profiles_username_shape check (username ~ '^[a-z0-9_.]{3,30}$');
  end if;
end;
$$;

-- 0001's `unique` is case-sensitive, which would let "Mateo" and "mateo" both
-- exist and make lookup ambiguous.
create unique index if not exists profiles_username_lower_key on profiles (lower(username));

-- Prefix search for the "find a friend" screen.
create index if not exists profiles_username_search
  on profiles (lower(username) text_pattern_ops);

-- ── A profile for every new account ──────────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, username, display_name, avatar_url)
  values (
    new.id,
    claim_username(
      coalesce(
        new.raw_user_meta_data ->> 'preferred_username',
        new.raw_user_meta_data ->> 'user_name',
        split_part(coalesce(new.email, ''), '@', 1)
      )
    ),
    nullif(
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    -- A trigger on auth.users that raises makes Supabase reject the entire
    -- signup with "Database error saving new user", locking the user out for
    -- good. A missing profile is recoverable (ensure_profile below); an account
    -- that can never be created is not.
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Client-callable repair: returns the caller's profile, creating it if the
-- trigger above ever swallowed an error.
create or replace function ensure_profile()
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result profiles;
begin
  select * into result from profiles where user_id = auth.uid();
  if found then
    return result;
  end if;

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into profiles (user_id, username)
  values (auth.uid(), claim_username(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)))
  returning * into result;

  return result;
end;
$$;

revoke execute on function ensure_profile() from public;
grant execute on function ensure_profile() to authenticated;

-- ── Keep updated_at honest ───────────────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch
  before update on profiles
  for each row execute function touch_updated_at();

-- ── Security fix: the feed view bypassed RLS ─────────────────────────────────
-- A Postgres view runs with its *definer's* rights unless it opts in, so the
-- 0004 `feed` view handed every user's friends/public rows to any authenticated
-- caller — the row policies on visits/dishes/restaurants were never consulted,
-- and `are_friends` never entered into it. `security_invoker` runs the view as
-- the caller, which is what the visibility model assumed all along.
create or replace view feed with (security_invoker = true) as
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
