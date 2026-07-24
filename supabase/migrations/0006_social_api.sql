-- The RPCs the social UI talks to (docs/06). Verify with `supabase db reset`.
--
-- Friendships are stored one row per pair in canonical order (user_a < user_b,
-- from 0004). Making the client compute that ordering would spread a storage
-- detail across the app and invite rows that violate it, so every mutation goes
-- through a function here instead.
--
-- These are `security definer` because they legitimately read rows the caller
-- does not own (another user's profile, a friend's visit). Each one therefore
-- re-checks the relationship itself — RLS is not doing it for them.

-- ── Reading relationships ────────────────────────────────────────────────────
-- How the caller relates to another user, as one word the UI can switch on.
create or replace function friendship_state(other uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when f.status = 'accepted' then 'friends'
        when f.requested_by = auth.uid() then 'request_sent'
        else 'request_received'
      end
      from friendships f
      where f.user_a = least(auth.uid(), other)
        and f.user_b = greatest(auth.uid(), other)
    ),
    case when other = auth.uid() then 'self' else 'none' end
  );
$$;

-- Prefix search over usernames and display names, annotated with the caller's
-- relationship so the UI can render the right button without a second query.
create or replace function search_users(q text, max_results int default 20)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  state text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.username, p.display_name, p.avatar_url, friendship_state(p.user_id)
  from profiles p
  where p.user_id <> auth.uid()
    and length(coalesce(q, '')) >= 2
    and (
      lower(p.username) like lower(q) || '%'
      or lower(coalesce(p.display_name, '')) like '%' || lower(q) || '%'
    )
  order by
    -- Exact handle first, then handle prefixes, then name matches.
    (lower(p.username) = lower(q)) desc,
    (lower(p.username) like lower(q) || '%') desc,
    p.username
  limit least(coalesce(max_results, 20), 50);
$$;

-- Everyone the caller is connected to, in either direction, with the profile
-- fields needed to render a row.
create or replace function list_friendships()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  state text,
  since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    case
      when f.status = 'accepted' then 'friends'
      when f.requested_by = auth.uid() then 'request_sent'
      else 'request_received'
    end,
    f.created_at
  from friendships f
  join profiles p
    on p.user_id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by f.status, f.created_at desc;
$$;

-- ── Mutating relationships ───────────────────────────────────────────────────
-- Sends a request, or accepts one that already came the other way (which is
-- what a user means when they add someone who has just added them).
create or replace function send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing friendships;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if target = me then raise exception 'cannot befriend yourself'; end if;
  if not exists (select 1 from profiles where user_id = target) then
    raise exception 'user not found';
  end if;

  select * into existing from friendships
  where user_a = least(me, target) and user_b = greatest(me, target);

  if found then
    -- Their pending request + our request = mutual consent, so accept it.
    if existing.status = 'pending' and existing.requested_by <> me then
      update friendships set status = 'accepted'
      where user_a = least(me, target) and user_b = greatest(me, target);
      return 'friends';
    end if;
    return friendship_state(target);
  end if;

  insert into friendships (user_a, user_b, status, requested_by)
  values (least(me, target), greatest(me, target), 'pending', me);

  return 'request_sent';
end;
$$;

-- Accepts or declines a request that was sent *to* the caller. Declining
-- deletes the row so the other user may try again later.
create or replace function respond_friend_request(other uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing friendships;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into existing from friendships
  where user_a = least(me, other) and user_b = greatest(me, other) and status = 'pending';

  if not found then raise exception 'no pending request'; end if;

  -- Only the recipient may answer; the sender's route out is cancelling.
  if existing.requested_by = me then raise exception 'cannot answer your own request'; end if;

  if accept then
    update friendships set status = 'accepted'
    where user_a = least(me, other) and user_b = greatest(me, other);
    return 'friends';
  end if;

  delete from friendships
  where user_a = least(me, other) and user_b = greatest(me, other);
  return 'none';
end;
$$;

-- Removes a friendship or cancels a request the caller sent.
create or replace function remove_friend(other uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;

  delete from friendships
  where user_a = least(me, other) and user_b = greatest(me, other);

  return 'none';
end;
$$;

-- ── Feed ─────────────────────────────────────────────────────────────────────
-- The 0004 `feed` view returns bare uuids, which would cost the client one
-- round trip per row to render anything. This returns rows ready to paint:
-- author identity, a title, the place, a rating and a cover image.
create or replace function feed_page(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  kind text,
  entity_uuid uuid,
  author_id uuid,
  username text,
  display_name text,
  avatar_url text,
  occurred_at timestamptz,
  title text,
  place text,
  rating int,
  comments text,
  image_key text
)
language sql
stable
security definer
set search_path = public
as $$
  with friends as (
    select case when user_a = auth.uid() then user_b else user_a end as id
    from friendships
    where status = 'accepted' and auth.uid() in (user_a, user_b)
  ),
  entries as (
    select
      'visit'::text as kind,
      v.uuid as entity_uuid,
      v.user_id as author_id,
      v.created_at as occurred_at,
      coalesce(r.name, 'Una visita') as title,
      r.name as place,
      null::int as rating,
      v.comments,
      v.visibility
    from visits v
    left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
    where v.deleted = false and v.user_id in (select id from friends)

    union all

    select
      'dish', d.uuid, d.user_id, d.created_at,
      d.name, r.name, d.rating, d.comments, d.visibility
    from dishes d
    left join restaurants r on r.uuid = d.restaurant_uuid and r.deleted = false
    where d.deleted = false and d.user_id in (select id from friends)

    union all

    select
      'restaurant', r.uuid, r.user_id, r.created_at,
      r.name, null, r.rating, r.comments, r.visibility
    from restaurants r
    where r.deleted = false and r.user_id in (select id from friends)
  )
  select
    e.kind,
    e.entity_uuid,
    e.author_id,
    p.username,
    p.display_name,
    p.avatar_url,
    e.occurred_at,
    e.title,
    e.place,
    e.rating,
    e.comments,
    (
      select i.remote_key
      from images i
      where i.deleted = false
        and i.remote_key is not null
        and (i.visit_uuid = e.entity_uuid
          or i.dish_uuid = e.entity_uuid
          or i.restaurant_uuid = e.entity_uuid)
      order by i.created_at
      limit 1
    ) as image_key
  from entries e
  join profiles p on p.user_id = e.author_id
  where e.visibility in ('friends', 'public')
    and (before is null or e.occurred_at < before)
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- security definer functions are executable by `public` unless revoked, which
-- would expose every one of them to the anon key.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'friendship_state(uuid)',
    'search_users(text, int)',
    'list_friendships()',
    'send_friend_request(uuid)',
    'respond_friend_request(uuid, boolean)',
    'remove_friend(uuid)',
    'feed_page(timestamptz, int)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
