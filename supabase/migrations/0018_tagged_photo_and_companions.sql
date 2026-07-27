-- La foto de la visita, y con quien fuiste por su nombre. Verificar con `npm run db:test`.

-- ── 1. La etiqueta ensenaba la foto del restaurante ──────────────────────────
--
-- `tagged_visits` elige entre las fotos de la visita y las del restaurante, y
-- pretendia quedarse con las de la visita primero:
--
--     order by (i.visit_uuid = v.uuid) desc, i.created_at
--
-- Para una foto del restaurante, `i.visit_uuid` es NULL, asi que la comparacion
-- no da `false`: da **NULL**. Y en Postgres `DESC` ordena `NULLS FIRST` por
-- defecto, o sea que las fotos del restaurante se colocaban **por delante** de
-- las de la visita. Justo al reves de lo que decia el `order by`.
--
-- El efecto en pantalla es el que se reporto: la misma comida se veia con la
-- fachada del sitio en "Contigo" y con la foto de la mesa en el feed, porque
-- `feed_page` nunca mira las fotos del restaurante y aqui si.
--
-- Es un fallo que se lee bien y hace lo contrario, que es la clase de error que
-- sobrevive a las revisiones. `nulls last` lo arregla sin cambiar la intencion.

-- ── 2. "con 2 personas" no dice con quien ────────────────────────────────────
--
-- El conteo es lo unico que viajaba, asi que la app no podia decir mas. Y un
-- numero no es la respuesta a la pregunta que se hace uno al ver la tarjeta:
-- "con 2 personas" y "con Irene y Moni" ocupan lo mismo y solo una de las dos
-- dice algo.
--
-- Los nombres salen de `people`, que es la libreta de quien escribio la visita:
-- son *sus* nombres para esas personas, que es exactamente lo que quieres leer.
-- Se prefiere el nombre y no el @usuario: mezclarlos deja "con caro y Moni",
-- con una en minuscula, y el handle solo aporta si se puede tocar para abrir un
-- perfil, que en esta linea no se puede.

-- Anadir una columna al `returns table` cambia el tipo de retorno, y eso
-- `create or replace` no lo permite. Hay que soltarlas: el precio es que se van
-- tambien sus permisos, asi que se reponen al final del fichero. Olvidarlo
-- dejaria el feed devolviendo "permission denied" a todo el mundo.
drop function if exists tagged_visits(timestamptz, int);
drop function if exists feed_page(timestamptz, int);

create function tagged_visits(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, visited_at text, title text,
  comments text, image_key text, companion_count bigint, companion_names text[]
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
      -- `nulls last`: sin esto las del restaurante van delante. Ver arriba.
      order by (i.visit_uuid = v.uuid) desc nulls last, i.created_at
      limit 1
    ),
    (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid),
    coalesce((
      select array_agg(coalesce(pe.name, pe.username) order by pe.name)
      from visit_participant vp
      join people pe on pe.uuid = vp.person_uuid and pe.deleted = false
      where vp.visit_uuid = v.uuid
        -- Tu no eres compania tuya: la tarjeta cuenta a los demas.
        and (pe.linked_user_id is null or pe.linked_user_id <> auth.uid())
    ), array[]::text[])
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

create function feed_page(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  kind text, entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, title text, place text, rating int,
  comments text, image_key text, dish_names text[], companion_count bigint,
  companion_names text[]
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
    e.dish_names, e.companion_count, e.companion_names
  from entries e
  join profiles p on p.user_id = e.author_id
  where before is null or e.occurred_at < before
  order by e.occurred_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

-- ── Permisos, que el drop se llevo por delante ───────────────────────────────
do $$
begin
  execute 'revoke execute on function tagged_visits(timestamptz, int) from public';
  execute 'revoke execute on function feed_page(timestamptz, int) from public';
  execute 'grant execute on function tagged_visits(timestamptz, int) to authenticated';
  execute 'grant execute on function feed_page(timestamptz, int) to authenticated';
end;
$$;
