-- Ver una visita compartida entera. Verificar con `npm run db:test`.
--
-- Hasta aqui la visibilidad se decidia fila por fila, y eso rompe la unica cosa
-- que una visita compartida tiene que hacer. Si alguien guarda sus restaurantes
-- y sus platos en privado pero comparte una visita, quien la recibe veia "Una
-- visita" y nada mas: ni donde fue, ni que comieron. La visita es el envoltorio;
-- sin su contenido no queda nada que compartir.
--
-- Asi que la visibilidad se hace transitiva por las aristas que salen de una
-- visita: si puedes leer la visita, puedes leer el restaurante donde ocurrio y
-- los platos que quedaron anotados en ella. No al reves -- poder ver un plato
-- no te da acceso a las demas visitas a ese restaurante -- porque la decision
-- que tomo quien comparte fue sobre *esa comida*, no sobre el sitio.

-- ── Quien puede leer una visita ──────────────────────────────────────────────
-- Las tres puertas, en un solo sitio para que no se contradigan entre RPCs.
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
        -- Tuya.
        vi.user_id = auth.uid()
        -- Publica.
        or vi.visibility = 'public'
        -- De un amigo, y compartida.
        or (vi.visibility in ('friends', 'public') and are_friends(auth.uid(), vi.user_id))
        -- Estabas alli. La etiqueta abre la puerta por si sola: no hace falta
        -- ser amigo de alguien para haber cenado con esa persona.
        or (vi.visibility in ('friends', 'public') and is_tagged_in(vi.uuid, auth.uid()))
      )
  );
$$;

-- ── La visita entera, en una llamada ─────────────────────────────────────────
-- Devuelve json en vez de una tabla porque lo que se pide es un arbol: una
-- visita con su restaurante, sus platos, sus fotos y su gente. Aplanarlo en
-- filas obligaria al cliente a reconstruirlo, y devolver null cuando no se
-- puede leer dice exactamente lo mismo que devolver cero filas sin tener que
-- explicar la diferencia entre "no existe" y "no es para ti".
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
      'visibility', v.visibility,
      'created_at', v.created_at,
      'author', json_build_object(
        'user_id', p.user_id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url
      ),
      -- El restaurante viaja con la visita aunque sea privado: es donde
      -- ocurrio, no una entrada aparte del diario de alguien.
      'restaurant', (
        select json_build_object(
          'uuid', r.uuid,
          'name', r.name,
          'latitude', r.latitude,
          'longitude', r.longitude,
          -- Los comentarios y la nota del restaurante son opinion sobre el
          -- sitio en general, no sobre esta comida. Solo cuando el sitio
          -- tambien esta compartido.
          'rating', case when r.visibility in ('friends', 'public') then r.rating end,
          'comments', case when r.visibility in ('friends', 'public') then r.comments end
        )
        from restaurants r
        where r.uuid = v.restaurant_uuid and r.deleted = false
      ),
      'dishes', coalesce((
        select json_agg(json_build_object(
          'uuid', d.uuid,
          'name', d.name,
          'price', d.price,
          'rating', d.rating,
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
      -- Con quien fue. Solo las personas vinculadas a una cuenta llevan handle;
      -- las demas son un nombre, que es todo lo que hay que saber.
      'people', coalesce((
        select json_agg(json_build_object(
          'name', pe.name,
          'account_uuid', pe.linked_user_id,
          'username', pe.username
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

-- ── Las visitas en las que me etiquetaron ────────────────────────────────────
-- Bandeja aparte, nunca mezclada con el diario propio. Una visita ajena habla
-- de los restaurantes y los platos de otra persona; meterla en tu diario
-- ensuciaria tus listas con filas que no puedes editar y estadisticas sobre
-- comidas que no registraste tu.
create or replace function tagged_visits(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  entity_uuid uuid,
  author_id uuid,
  username text,
  display_name text,
  avatar_url text,
  occurred_at timestamptz,
  visited_at text,
  title text,
  comments text,
  image_key text,
  companion_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.uuid,
    v.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    v.created_at,
    v.visited_at,
    coalesce(r.name, 'Una visita'),
    v.comments,
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
    and v.visibility in ('friends', 'public')
    and is_tagged_in(v.uuid, auth.uid())
    and (before is null or v.created_at < before)
  order by v.created_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'can_read_visit(uuid)',
    'visit_detail(uuid)',
    'tagged_visits(timestamptz, int)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
