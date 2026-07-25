-- `default` como valor guardado. Verificar con `npm run db:test`.
--
-- Hasta aqui, crear una entrada copiaba el ajuste general en la fila. Eso
-- convierte el ajuste en una sugerencia de una sola vez: cambiarlo despues no
-- movia nada de lo ya escrito, y todo lo importado de la v1 -- que es casi todo
-- un diario de años -- se quedaba clavado en 'private' porque en la v1 ese
-- campo no existia. El usuario ponia "mis amigos ven mis visitas" y sus amigos
-- no veian nada.
--
-- Ahora 'default' es un valor real que significa "lo que digan mis ajustes,
-- ahora y mas adelante". Se resuelve al leer, no al escribir, que es la unica
-- forma en que algo llamado *default* puede comportarse sin mentir.
--
-- El precio es que ninguna comprobacion de visibilidad puede volver a mirar la
-- columna directamente. Todas pasan por effective_visibility().

-- ── Los ajustes generales, en el servidor ────────────────────────────────────
-- Tienen que estar aqui: es el servidor quien decide si tu amigo puede leer una
-- fila, y con la preferencia solo en el movil no tendria con que resolverla.
create table if not exists visibility_defaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  restaurant text not null default 'private' check (restaurant in ('private', 'friends', 'public')),
  dish text not null default 'private' check (dish in ('private', 'friends', 'public')),
  visit text not null default 'private' check (visit in ('private', 'friends', 'public')),
  updated_at timestamptz not null default now()
);

alter table visibility_defaults enable row level security;

create policy visibility_defaults_owner on visibility_defaults
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Y legibles por cualquiera que este autenticado, porque toda comprobacion de
-- lectura ajena necesita resolver el default de *otra* persona. Solo dicen con
-- que se comparte, nunca que hay dentro.
create policy visibility_defaults_readable on visibility_defaults
  for select
  using (auth.uid() is not null);

-- Las tres columnas de una vez: es una sola decision del usuario y partirla en
-- tres llamadas invita a que el movil se quede a medias.
create or replace function set_visibility_defaults(
  restaurant text,
  dish text,
  visit text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into visibility_defaults (user_id, restaurant, dish, visit, updated_at)
  values (auth.uid(), restaurant, dish, visit, now())
  on conflict (user_id) do update set
    restaurant = excluded.restaurant,
    dish = excluded.dish,
    visit = excluded.visit,
    updated_at = now();
$$;

-- ── Resolver ─────────────────────────────────────────────────────────────────
-- Sin fila de ajustes, privado. Que es lo mismo que hacia antes el default de
-- la app, asi que una cuenta que nunca ha tocado nada no cambia de
-- comportamiento por aplicar esta migracion.
create or replace function effective_visibility(stored text, owner uuid, entity text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when stored <> 'default' then stored
    else coalesce(
      (
        select case entity
          when 'restaurant' then vd.restaurant
          when 'dish' then vd.dish
          when 'visit' then vd.visit
        end
        from visibility_defaults vd
        where vd.user_id = owner
      ),
      'private'
    )
  end;
$$;

-- Atajos, porque `effective_visibility(v.visibility, v.user_id, 'visit') in
-- ('friends','public')` repetido doce veces es donde se cuela un error.
create or replace function is_shared(stored text, owner uuid, entity text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select effective_visibility(stored, owner, entity) in ('friends', 'public');
$$;

-- ── El espejo acepta el valor nuevo ──────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['restaurants', 'dishes', 'visits'] loop
    execute format('alter table %I drop constraint if exists %I', t, t || '_visibility_check');
    execute format(
      'alter table %I add constraint %I check (visibility in (''default'', ''private'', ''friends'', ''public''))',
      t, t || '_visibility_check'
    );
    execute format('alter table %I alter column visibility set default ''default''', t);
  end loop;
end;
$$;

-- Las filas que ya estan: mismo criterio que en el movil. 'friends' y 'public'
-- solo pueden estar ahi porque alguien los eligio; 'private' es lo que le toco
-- a toda fila que nunca tuvo eleccion.
update restaurants set visibility = 'default' where visibility = 'private';
update dishes set visibility = 'default' where visibility = 'private';
update visits set visibility = 'default' where visibility = 'private';

-- ── Las policies de lectura entre amigos ─────────────────────────────────────
do $$
declare
  t text;
  entity text;
begin
  foreach t in array array['restaurants', 'dishes', 'visits'] loop
    entity := left(t, length(t) - 1);
    execute format('drop policy if exists %I on %I', t || '_friend_read', t);
    execute format(
      'create policy %I on %I for select using (' ||
      'is_shared(visibility, user_id, %L) and are_friends(auth.uid(), user_id))',
      t || '_friend_read', t, entity
    );
  end loop;
end;
$$;

drop policy if exists visits_tagged_read on visits;
create policy visits_tagged_read on visits
  for select
  using (is_shared(visibility, user_id, 'visit') and is_active_tag(uuid, auth.uid()));

-- ── Y todas las RPC ──────────────────────────────────────────────────────────
create or replace function can_read_visit(v uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from visits vi
    where vi.uuid = v
      and vi.deleted = false
      and (
        vi.user_id = auth.uid()
        or effective_visibility(vi.visibility, vi.user_id, 'visit') = 'public'
        or (
          is_shared(vi.visibility, vi.user_id, 'visit')
          and (
            are_friends(auth.uid(), vi.user_id)
            or is_active_tag(vi.uuid, auth.uid())
          )
        )
      )
  );
$$;

create or replace function tagged_visits(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, visited_at text, title text,
  comments text, image_key text, companion_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.uuid, v.user_id, p.username, p.display_name, p.avatar_url,
    v.created_at, v.visited_at, coalesce(r.name, 'Una visita'), v.comments,
    (
      select i.remote_key from images i
      where i.deleted = false and i.remote_key is not null
        and (i.visit_uuid = v.uuid or i.restaurant_uuid = r.uuid)
      order by (i.visit_uuid = v.uuid) desc, i.created_at
      limit 1
    ),
    (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid)
  from visits v
  join profiles p on p.user_id = v.user_id
  left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
  where v.deleted = false
    and v.user_id <> auth.uid()
    and is_shared(v.visibility, v.user_id, 'visit')
    and is_active_tag(v.uuid, auth.uid())
    and (before is null or v.created_at < before)
  order by v.created_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

create or replace function feed_page(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  kind text, entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, title text, place text, rating int,
  comments text, image_key text, dish_names text[], companion_count bigint
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
  shared_visits as (
    select v.*
    from visits v
    where v.deleted = false
      and v.user_id in (select id from friends)
      and is_shared(v.visibility, v.user_id, 'visit')
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
    left join restaurants r on r.uuid = d.restaurant_uuid and r.deleted = false
    where d.deleted = false
      and d.user_id in (select id from friends)
      and is_shared(d.visibility, d.user_id, 'dish')
      and not exists (
        select 1 from dish_visit dv
        join shared_visits sv on sv.uuid = dv.visit_uuid
        where dv.dish_uuid = d.uuid and sv.user_id = d.user_id
      )

    union all

    select 'restaurant', r.uuid, r.user_id, r.created_at, r.name, null, r.rating,
           r.comments, array[]::text[], 0::bigint
    from restaurants r
    where r.deleted = false
      and r.user_id in (select id from friends)
      and is_shared(r.visibility, r.user_id, 'restaurant')
      and not exists (
        select 1 from shared_visits sv
        where sv.restaurant_uuid = r.uuid and sv.user_id = r.user_id
      )
  )
  select
    e.kind, e.entity_uuid, e.author_id, p.username, p.display_name, p.avatar_url,
    e.occurred_at, e.title, e.place, e.rating, e.comments,
    (
      select i.remote_key from images i
      where i.deleted = false and i.remote_key is not null
        and (i.visit_uuid = e.entity_uuid or i.dish_uuid = e.entity_uuid
          or i.restaurant_uuid = e.entity_uuid)
      order by i.created_at limit 1
    ),
    e.dish_names, e.companion_count
  from entries e
  join profiles p on p.user_id = e.author_id
  where before is null or e.occurred_at < before
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

create or replace function user_entries(
  target uuid,
  before timestamptz default null,
  page_size int default 20
)
returns table (
  kind text, entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, title text, place text, rating int,
  comments text, image_key text, dish_names text[], companion_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with access as (select friendship_state(target) as state),
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
    where v.deleted = false and v.user_id = target
      and effective_visibility(v.visibility, v.user_id, 'visit') = any (vis.levels)
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
    where d.deleted = false and d.user_id = target
      and effective_visibility(d.visibility, d.user_id, 'dish') = any (vis.levels)
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
    where r.deleted = false and r.user_id = target
      and effective_visibility(r.visibility, r.user_id, 'restaurant') = any (vis.levels)
      and not exists (select 1 from shared_visits sv where sv.restaurant_uuid = r.uuid)
  )
  select
    e.kind, e.entity_uuid, e.author_id, p.username, p.display_name, p.avatar_url,
    e.occurred_at, e.title, e.place, e.rating, e.comments,
    (
      select i.remote_key from images i
      where i.deleted = false and i.remote_key is not null
        and (i.visit_uuid = e.entity_uuid or i.dish_uuid = e.entity_uuid
          or i.restaurant_uuid = e.entity_uuid)
      order by i.created_at limit 1
    ),
    e.dish_names, e.companion_count
  from entries e
  join profiles p on p.user_id = e.author_id
  where before is null or e.occurred_at < before
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

create or replace function user_profile(target uuid)
returns table (
  user_id uuid, username text, display_name text, avatar_url text, bio text,
  state text, shared_count bigint, friend_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id, p.username, p.display_name, p.avatar_url,
    case when friendship_state(p.user_id) in ('friends', 'self') then p.bio end,
    friendship_state(p.user_id),
    (
      select count(*)
      from visits v
      where v.user_id = p.user_id and v.deleted = false
        and (
          friendship_state(p.user_id) = 'self'
          or (friendship_state(p.user_id) = 'friends'
            and is_shared(v.visibility, v.user_id, 'visit'))
          or effective_visibility(v.visibility, v.user_id, 'visit') = 'public'
        )
    ),
    (
      select count(*) from friendships f
      where f.status = 'accepted' and p.user_id in (f.user_a, f.user_b)
    )
  from profiles p
  where p.user_id = target;
$$;

-- El detalle tambien: el restaurante suelta su nota y sus comentarios solo si
-- el sitio esta compartido, y eso ahora depende de los ajustes de su dueño.
create or replace function visit_detail(target uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when can_read_visit(target) then (
    select json_build_object(
      'uuid', v.uuid,
      'visited_at', v.visited_at,
      'comments', v.comments,
      'visibility', effective_visibility(v.visibility, v.user_id, 'visit'),
      'created_at', v.created_at,
      'author', json_build_object(
        'user_id', p.user_id, 'username', p.username,
        'display_name', p.display_name, 'avatar_url', p.avatar_url
      ),
      'restaurant', (
        select json_build_object(
          'uuid', r.uuid, 'name', r.name,
          'latitude', r.latitude, 'longitude', r.longitude,
          'rating', case when is_shared(r.visibility, r.user_id, 'restaurant') then r.rating end,
          'comments', case when is_shared(r.visibility, r.user_id, 'restaurant') then r.comments end
        )
        from restaurants r
        where r.uuid = v.restaurant_uuid and r.deleted = false
      ),
      'dishes', coalesce((
        select json_agg(json_build_object(
          'uuid', d.uuid, 'name', d.name, 'price', d.price, 'rating', d.rating,
          'comments', d.comments,
          'image_key', (
            select i.remote_key from images i
            where i.dish_uuid = d.uuid and i.deleted = false and i.remote_key is not null
            order by i.created_at limit 1
          )
        ) order by d.name)
        from dish_visit dv
        join dishes d on d.uuid = dv.dish_uuid and d.deleted = false
        where dv.visit_uuid = v.uuid
      ), '[]'::json),
      'images', coalesce((
        select json_agg(i.remote_key order by i.created_at)
        from images i
        where i.visit_uuid = v.uuid and i.deleted = false and i.remote_key is not null
      ), '[]'::json),
      'people', coalesce((
        select json_agg(json_build_object(
          'name', pe.name, 'account_uuid', pe.linked_user_id, 'username', pe.username
        ) order by pe.name)
        from visit_participant vp
        join people pe on pe.uuid = vp.person_uuid and pe.deleted = false
        where vp.visit_uuid = v.uuid
      ), '[]'::json)
    )
    from visits v
    join profiles p on p.user_id = v.user_id
    where v.uuid = target
  ) end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'effective_visibility(text, uuid, text)',
    'is_shared(text, uuid, text)',
    'set_visibility_defaults(text, text, text)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
