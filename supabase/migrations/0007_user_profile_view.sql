-- Reading someone else's profile page (docs/06). Verify with `npm run db:test`.
--
-- 0006 gave the feed and the friend list. What was still missing is the screen
-- you land on when you tap a person: who they are, how you relate to them, and
-- what they have chosen to share — for a stranger, that last part is empty.

-- Everything the profile header needs, in one round trip.
create or replace function user_profile(target uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  state text,
  shared_count bigint,
  friend_count bigint
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
    -- The bio is part of the public face, but only once you can actually see
    -- the person's content; to a stranger the page stays a name and a handle.
    case when friendship_state(p.user_id) in ('friends', 'self') then p.bio end,
    friendship_state(p.user_id),
    (
      select count(*)
      from visits v
      where v.user_id = p.user_id
        and v.deleted = false
        and (
          friendship_state(p.user_id) = 'self'
          or (friendship_state(p.user_id) = 'friends' and v.visibility in ('friends', 'public'))
          or v.visibility = 'public'
        )
    ),
    (
      select count(*)
      from friendships f
      where f.status = 'accepted' and p.user_id in (f.user_a, f.user_b)
    )
  from profiles p
  where p.user_id = target;
$$;

-- One person's shareable activity, same shape as `feed_page` so the UI can
-- reuse the card. Returns nothing unless the caller is allowed to see it.
create or replace function user_entries(
  target uuid,
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
  with access as (
    select friendship_state(target) as state
  ),
  visible as (
    select case
      when (select state from access) = 'self' then array['private', 'friends', 'public']
      when (select state from access) = 'friends' then array['friends', 'public']
      else array['public']
    end as levels
  ),
  entries as (
    select
      'visit'::text as kind, v.uuid as entity_uuid, v.user_id as author_id,
      v.created_at as occurred_at, coalesce(r.name, 'Una visita') as title,
      r.name as place, null::int as rating, v.comments, v.visibility
    from visits v
    left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
    where v.deleted = false and v.user_id = target

    union all

    select 'dish', d.uuid, d.user_id, d.created_at, d.name, r.name, d.rating,
           d.comments, d.visibility
    from dishes d
    left join restaurants r on r.uuid = d.restaurant_uuid and r.deleted = false
    where d.deleted = false and d.user_id = target

    union all

    select 'restaurant', r.uuid, r.user_id, r.created_at, r.name, null, r.rating,
           r.comments, r.visibility
    from restaurants r
    where r.deleted = false and r.user_id = target
  )
  select
    e.kind, e.entity_uuid, e.author_id, p.username, p.display_name, p.avatar_url,
    e.occurred_at, e.title, e.place, e.rating, e.comments,
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
    )
  from entries e
  join profiles p on p.user_id = e.author_id
  -- One row, so the cross join just makes `levels` addressable; a scalar
  -- subquery here reads as a row expression and won't compare to an array.
  cross join visible vis
  where e.visibility = any (vis.levels)
    and (before is null or e.occurred_at < before)
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'user_profile(uuid)',
    'user_entries(uuid, timestamptz, int)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
