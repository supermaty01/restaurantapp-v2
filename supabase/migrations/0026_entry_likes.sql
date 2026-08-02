-- Me gusta en lo que comparten tus amigos. Verificar con `npm run db:test`.
--
-- Lo primero que la app deja hacer **sobre lo de otra persona**. Hasta aquí todo
-- lo social era leer (el feed, un perfil) o escribir en lo tuyo (etiquetar a
-- alguien en tu visita); esto escribe una fila que habla de una entrada ajena, y
-- por eso la parte de acceso es la mitad del trabajo.
--
-- ## La tabla, y por qué no tiene clave ajena a lo que le gusta
--
-- Un «me gusta» apunta a una de tres tablas —visita, plato o sitio— y Postgres
-- no sabe hacer una clave ajena a la unión de tres. Las dos salidas eran tres
-- columnas anulables con una restricción de «exactamente una» (el patrón de
-- `images`) o una sola columna sin clave ajena.
--
-- Aquí se elige la segunda, y el motivo es que **el coste de equivocarse es
-- distinto**. En `images` una fila huérfana es una foto que se pinta en algún
-- sitio; aquí una fila huérfana no la ve nadie, porque todo lo que lee esta
-- tabla parte de la entidad y hace `join` hacia ella. Los uuid son únicos entre
-- las tres tablas, así que la fila tampoco puede colarse en el recuento de otra
-- cosa. Lo que se pierde es el borrado en cascada: si alguien borra un plato del
-- todo, sus «me gusta» quedan ahí sin que nadie los lea nunca. Es basura, y es
-- barata.
--
-- `kind` no participa en ninguna clave: está para poder mirar la tabla y
-- entenderla, y para que un recuento por clase no tenga que consultar tres
-- tablas.
--
-- ## El acceso
--
-- La tabla **no se lee desde el cliente salvo lo tuyo**. Es la lección de
-- AGENTS §3.4: una policy `for select` sobre la tabla la abre entera, y aquí la
-- tabla entera es «quién ha dado me gusta a qué», que es una lista de qué mira
-- cada persona. Los recuentos ajenos salen de las funciones `security definer`
-- que ya reparten el feed, y esas devuelven **un número**, no las filas.
--
-- Y dar me gusta comprueba que puedes leer lo que te gusta, con las mismas tres
-- funciones de siempre (`can_read_visit`, `can_read_dish`, `can_read_restaurant`
-- de 0011 y 0025). Sin eso, un cliente podría dar me gusta a un uuid que se
-- inventara y el recuento de una entrada privada empezaría a subir — que no
-- enseña el contenido, pero sí confirma que existe.

create table if not exists entry_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_uuid uuid not null,
  kind text not null check (kind in ('visit', 'dish', 'restaurant')),
  created_at timestamptz not null default now(),
  primary key (user_id, entity_uuid)
);

-- El recuento es lo único que se pide de esta tabla, y siempre por entidad.
create index if not exists entry_likes_entity_idx on entry_likes (entity_uuid);

alter table entry_likes enable row level security;

-- Lo tuyo y nada más. Quitar el `select` de aquí no serviría —hace falta para
-- que el `delete` de `toggle_like` encuentre la fila— pero sí acota lo que
-- PostgREST puede devolver a un cliente que consulte la tabla directamente.
create policy entry_likes_own on entry_likes
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Dar y quitar ────────────────────────────────────────────────────────────
--
-- Un solo verbo, porque es un solo botón. Dos funciones («dar» y «quitar»)
-- obligarían al cliente a saber el estado actual antes de llamar, y el estado
-- actual es justo lo que puede estar desactualizado en la pantalla — con dos
-- verbos, un doble toque rápido acaba en «ya existe» o «no existe» según el
-- orden en que lleguen.
--
-- Devuelve el estado resultante entero para que la pantalla no tenga que
-- adivinarlo: si el optimismo del cliente se equivocó, la respuesta lo corrige.
create or replace function toggle_like(target uuid, kind text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  allowed boolean;
  removed int;
  now_liked boolean;
begin
  if me is null then
    raise exception 'No has iniciado sesión' using errcode = '42501';
  end if;

  allowed := case kind
    when 'visit' then can_read_visit(target)
    when 'dish' then can_read_dish(target)
    when 'restaurant' then can_read_restaurant(target)
    else false
  end;

  -- El mismo mensaje para «no existe» y «no es para ti», igual que en los
  -- detalles: distinguirlos le cuenta a un desconocido qué hay escrito.
  if not allowed then
    raise exception 'No se puede ver esta entrada' using errcode = '42501';
  end if;

  delete from entry_likes l
    where l.user_id = me and l.entity_uuid = target;
  get diagnostics removed = row_count;

  if removed = 0 then
    insert into entry_likes (user_id, entity_uuid, kind)
      values (me, target, kind);
    now_liked := true;
  else
    now_liked := false;
  end if;

  return json_build_object(
    'liked', now_liked,
    'total', (select count(*) from entry_likes l where l.entity_uuid = target)
  );
end;
$$;

-- ── Los recuentos viajan con lo que se está pintando ────────────────────────
--
-- Y no en una llamada aparte, que era la otra opción y la que parecía más
-- barata de escribir. Se descartó porque una segunda petición por página
-- significa que las tarjetas aparecen primero sin corazón y lo estrenan medio
-- segundo después: un contador que salta solo se lee como que acaba de darle
-- alguien. Aquí son dos subconsultas sobre un índice, y ya se está haciendo una
-- por la foto.
--
-- Las tres funciones se **sueltan** antes: añadir columnas al `returns table`
-- cambia el tipo de retorno y `create or replace` no lo permite. El precio es
-- que se van sus permisos, que se reponen al final — olvidarlo deja el feed
-- contestando «permission denied» a todo el mundo (0018 ya lo pagó una vez).

drop function if exists feed_page(timestamptz, int);
drop function if exists tagged_visits(timestamptz, int);
drop function if exists user_entries_page(uuid, text, text, boolean, int, int, int);

create function feed_page(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  kind text, entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, title text, place text, rating int,
  comments text, image_key text, dish_names text[], companion_count bigint,
  companion_names text[], like_count bigint, liked_by_me boolean
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
      (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid) as companion_count,
      coalesce((
        select array_agg(coalesce(pe.name, pe.username) order by pe.name)
        from visit_participant vp
        join people pe on pe.uuid = vp.person_uuid and pe.deleted = false
        where vp.visit_uuid = v.uuid
          and (pe.linked_user_id is null or pe.linked_user_id <> auth.uid())
      ), array[]::text[]) as companion_names
    from shared_visits v
    left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false

    union all

    select 'dish', d.uuid, d.user_id, d.created_at, d.name, r.name, d.rating,
           d.comments, array[]::text[], 0::bigint, array[]::text[]
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
           r.comments, array[]::text[], 0::bigint, array[]::text[]
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
    e.dish_names, e.companion_count, e.companion_names,
    (select count(*) from entry_likes l where l.entity_uuid = e.entity_uuid),
    exists (
      select 1 from entry_likes l
      where l.entity_uuid = e.entity_uuid and l.user_id = auth.uid()
    )
  from entries e
  join profiles p on p.user_id = e.author_id
  where before is null or e.occurred_at < before
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

create function tagged_visits(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, visited_at text, title text,
  comments text, image_key text, companion_count bigint, companion_names text[],
  like_count bigint, liked_by_me boolean
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
      -- `nulls last`: sin esto las del restaurante van delante (0018).
      order by (i.visit_uuid = v.uuid) desc nulls last, i.created_at
      limit 1
    ),
    (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid),
    coalesce((
      select array_agg(coalesce(pe.name, pe.username) order by pe.name)
      from visit_participant vp
      join people pe on pe.uuid = vp.person_uuid and pe.deleted = false
      where vp.visit_uuid = v.uuid
        and (pe.linked_user_id is null or pe.linked_user_id <> auth.uid())
    ), array[]::text[]),
    (select count(*) from entry_likes l where l.entity_uuid = v.uuid),
    exists (
      select 1 from entry_likes l where l.entity_uuid = v.uuid and l.user_id = auth.uid()
    )
  from visits v
  join profiles p on p.user_id = v.user_id
  left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
  where v.deleted = false
    and v.user_id <> auth.uid()
    and is_active_tag(v.uuid, auth.uid())
    and (before is null or v.created_at < before)
  order by v.created_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

create function user_entries_page(
  target uuid,
  kind_filter text default null,
  sort_by text default 'date',
  descending boolean default true,
  min_rating int default null,
  page_offset int default 0,
  page_size int default 20
)
returns table (
  kind text, entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, title text, place text, rating int,
  comments text, image_key text, dish_names text[], companion_count bigint,
  like_count bigint, liked_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
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
    e.dish_names, e.companion_count,
    (select count(*) from entry_likes l where l.entity_uuid = e.entity_uuid),
    exists (
      select 1 from entry_likes l
      where l.entity_uuid = e.entity_uuid and l.user_id = auth.uid()
    )
  from user_entries_all(target) e
  join profiles p on p.user_id = e.author_id
  where (kind_filter is null or e.kind = kind_filter)
    and (min_rating is null or e.kind = 'visit' or coalesce(e.rating, 0) >= min_rating)
  order by
    -- Sin nota al final en los dos sentidos: «no puntuado» no es «cero», y
    -- tampoco es «lo mejor». Es una respuesta que no está.
    case when sort_by = 'rating' and descending then e.rating end desc nulls last,
    case when sort_by = 'rating' and not descending then e.rating end asc nulls last,
    -- `lower()` para que «Ávila» no caiga detrás de «zumo».
    case when sort_by = 'name' and descending then lower(e.title) end desc,
    case when sort_by = 'name' and not descending then lower(e.title) end asc,
    case when sort_by = 'date' and not descending then e.occurred_at end asc,
    -- El desempate de todos los criterios: sin él, dos platos con la misma nota
    -- pueden cambiar de sitio entre dos páginas y salir repetidos o no salir.
    e.occurred_at desc,
    e.entity_uuid
  offset greatest(coalesce(page_offset, 0), 0)
  limit least(coalesce(page_size, 20), 50);
$$;

-- ── Y el detalle de una visita ──────────────────────────────────────────────
--
-- Idéntica a la de 0025 salvo por las dos claves nuevas. Se reescribe entera
-- porque Postgres no sabe editar el cuerpo de una función.
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
      'like_count', (select count(*) from entry_likes l where l.entity_uuid = v.uuid),
      'liked_by_me', exists (
        select 1 from entry_likes l where l.entity_uuid = v.uuid and l.user_id = auth.uid()
      ),
      'author', json_build_object(
        'user_id', p.user_id, 'username', p.username,
        'display_name', p.display_name, 'avatar_url', p.avatar_url
      ),
      'restaurant', (
        select json_build_object(
          'uuid', r.uuid, 'name', r.name,
          'latitude', r.latitude, 'longitude', r.longitude,
          'rating', case when is_shared(r.visibility, r.user_id, 'restaurant') then r.rating end,
          'comments', case when is_shared(r.visibility, r.user_id, 'restaurant') then r.comments end,
          'can_open', can_read_restaurant(r.uuid)
        )
        from restaurants r
        where r.uuid = v.restaurant_uuid and r.deleted = false
      ),
      'dishes', coalesce((
        select json_agg(json_build_object(
          'uuid', d.uuid, 'name', d.name, 'price', d.price, 'currency', d.currency,
          'rating', d.rating,
          'comments', d.comments,
          'can_open', can_read_dish(d.uuid),
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

-- ── Y el de un plato y un sitio ─────────────────────────────────────────────
create or replace function dish_detail(target uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when can_read_dish(target) then (
    select json_build_object(
      'uuid', d.uuid,
      'name', d.name,
      'price', d.price,
      'currency', d.currency,
      'rating', d.rating,
      'comments', d.comments,
      'created_at', d.created_at,
      'like_count', (select count(*) from entry_likes l where l.entity_uuid = d.uuid),
      'liked_by_me', exists (
        select 1 from entry_likes l where l.entity_uuid = d.uuid and l.user_id = auth.uid()
      ),
      'author', json_build_object(
        'user_id', p.user_id, 'username', p.username,
        'display_name', p.display_name, 'avatar_url', p.avatar_url
      ),
      'restaurant', (
        select json_build_object(
          'uuid', r.uuid,
          'name', r.name,
          'can_open', can_read_restaurant(r.uuid)
        )
        from restaurants r
        where r.uuid = d.restaurant_uuid and r.deleted = false
      ),
      'images', coalesce((
        select json_agg(i.remote_key order by i.created_at)
        from images i
        where i.dish_uuid = d.uuid and i.deleted = false and i.remote_key is not null
      ), '[]'::json)
    )
    from dishes d
    join profiles p on p.user_id = d.user_id
    where d.uuid = target
  ) end;
$$;

create or replace function restaurant_detail(target uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when can_read_restaurant(target) then (
    select json_build_object(
      'uuid', r.uuid,
      'name', r.name,
      'latitude', r.latitude,
      'longitude', r.longitude,
      'rating', r.rating,
      'comments', r.comments,
      'created_at', r.created_at,
      'like_count', (select count(*) from entry_likes l where l.entity_uuid = r.uuid),
      'liked_by_me', exists (
        select 1 from entry_likes l where l.entity_uuid = r.uuid and l.user_id = auth.uid()
      ),
      'author', json_build_object(
        'user_id', p.user_id, 'username', p.username,
        'display_name', p.display_name, 'avatar_url', p.avatar_url
      ),
      'images', coalesce((
        select json_agg(i.remote_key order by i.created_at)
        from images i
        where i.restaurant_uuid = r.uuid and i.deleted = false and i.remote_key is not null
      ), '[]'::json)
    )
    from restaurants r
    join profiles p on p.user_id = r.user_id
    where r.uuid = target
  ) end;
$$;

-- ── Permisos, incluidos los que el drop se llevó por delante ────────────────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'toggle_like(uuid, text)',
    'feed_page(timestamptz, int)',
    'tagged_visits(timestamptz, int)',
    'user_entries_page(uuid, text, text, boolean, int, int, int)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
