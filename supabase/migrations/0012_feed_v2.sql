-- El feed cuenta comidas, no filas. Verificar con `npm run db:test`.
--
-- La primera version unia tres tablas y devolvia una tarjeta por fila. Quien
-- comparte todo -- que es la configuracion mas natural de "quiero que mis
-- amigos vean lo que como" -- llenaba el feed con tres tarjetas por comida:
-- "descubrio Ichiran", "probo Tonkotsu", "estuvo en Ichiran". El diario de una
-- persona activa borraba a todas las demas del feed en una tarde.
--
-- La regla nueva: una entrada no aparece si ya esta representada por otra.
-- Un plato que se comio en una visita compartida viaja dentro de esa visita.
-- Un restaurante donde hay una visita compartida ya se ha contado.
--
-- Lo que queda es lo que de verdad pasó: comio aqui, probo esto suelto,
-- descubrio este sitio.

-- Postgres no deja cambiar la forma de las columnas de salida con `replace`,
-- y la forma cambia: las tarjetas ganan los platos y los acompañantes.
drop function if exists feed_page(timestamptz, int);
drop function if exists user_entries(uuid, timestamptz, int);

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
  image_key text,
  -- Lo que se comio en esa visita, para que la tarjeta lo pueda decir sin
  -- pedir el detalle de cada una.
  dish_names text[],
  companion_count bigint
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
  -- Las visitas compartidas de mis amigos: el eje del feed.
  shared_visits as (
    select v.*
    from visits v
    where v.deleted = false
      and v.visibility in ('friends', 'public')
      and v.user_id in (select id from friends)
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
      coalesce((
        select array_agg(d.name order by d.name)
        from dish_visit dv
        join dishes d on d.uuid = dv.dish_uuid and d.deleted = false
        where dv.visit_uuid = v.uuid
      ), array[]::text[]) as dish_names,
      (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid) as companion_count
    from shared_visits v
    left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false

    union all

    -- Solo los platos sueltos: los que se comieron en una visita compartida ya
    -- viajan dentro de ella.
    select
      'dish', d.uuid, d.user_id, d.created_at, d.name, r.name, d.rating, d.comments,
      array[]::text[], 0::bigint
    from dishes d
    left join restaurants r on r.uuid = d.restaurant_uuid and r.deleted = false
    where d.deleted = false
      and d.visibility in ('friends', 'public')
      and d.user_id in (select id from friends)
      and not exists (
        select 1 from dish_visit dv
        join shared_visits sv on sv.uuid = dv.visit_uuid
        where dv.dish_uuid = d.uuid and sv.user_id = d.user_id
      )

    union all

    -- Y solo los sitios donde todavia no ha contado ninguna comida.
    select
      'restaurant', r.uuid, r.user_id, r.created_at, r.name, null, r.rating, r.comments,
      array[]::text[], 0::bigint
    from restaurants r
    where r.deleted = false
      and r.visibility in ('friends', 'public')
      and r.user_id in (select id from friends)
      and not exists (
        select 1 from shared_visits sv
        where sv.restaurant_uuid = r.uuid and sv.user_id = r.user_id
      )
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
    ) as image_key,
    e.dish_names,
    e.companion_count
  from entries e
  join profiles p on p.user_id = e.author_id
  where before is null or e.occurred_at < before
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

-- `user_entries` tiene el mismo problema, y la misma solucion: el perfil de una
-- persona tampoco deberia repetir la misma comida tres veces.
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
  image_key text,
  dish_names text[],
  companion_count bigint
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
  shared_visits as (
    select v.*
    from visits v
    cross join visible vis
    where v.deleted = false and v.user_id = target and v.visibility = any (vis.levels)
  ),
  entries as (
    select
      'visit'::text as kind, v.uuid as entity_uuid, v.user_id as author_id,
      v.created_at as occurred_at, coalesce(r.name, 'Una visita') as title,
      r.name as place, null::int as rating, v.comments,
      coalesce((
        select array_agg(d.name order by d.name)
        from dish_visit dv
        join dishes d on d.uuid = dv.dish_uuid and d.deleted = false
        where dv.visit_uuid = v.uuid
      ), array[]::text[]) as dish_names,
      (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid) as companion_count
    from shared_visits v
    left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false

    union all

    select 'dish', d.uuid, d.user_id, d.created_at, d.name, r.name, d.rating,
           d.comments, array[]::text[], 0::bigint
    from dishes d
    cross join visible vis
    left join restaurants r on r.uuid = d.restaurant_uuid and r.deleted = false
    where d.deleted = false and d.user_id = target and d.visibility = any (vis.levels)
      and not exists (
        select 1 from dish_visit dv
        join shared_visits sv on sv.uuid = dv.visit_uuid
        where dv.dish_uuid = d.uuid
      )

    union all

    select 'restaurant', r.uuid, r.user_id, r.created_at, r.name, null, r.rating,
           r.comments, array[]::text[], 0::bigint
    from restaurants r
    cross join visible vis
    where r.deleted = false and r.user_id = target and r.visibility = any (vis.levels)
      and not exists (
        select 1 from shared_visits sv where sv.restaurant_uuid = r.uuid
      )
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
    ),
    e.dish_names,
    e.companion_count
  from entries e
  join profiles p on p.user_id = e.author_id
  where before is null or e.occurred_at < before
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'feed_page(timestamptz, int)',
    'user_entries(uuid, timestamptz, int)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
