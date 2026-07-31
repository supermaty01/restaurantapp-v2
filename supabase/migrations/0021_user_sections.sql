-- El perfil de otra persona, por secciones. Verificar con `npm run db:test`.
--
-- Hasta aqui era una sola lista mezclada: visitas, platos y sitios en el mismo
-- rio, ordenados por cuando se escribieron. En el diario propio esas tres cosas
-- viven detras de un control segmentado (Diario) porque son tres formas de mirar
-- lo mismo y se alterna entre ellas constantemente; en el perfil ajeno no habia
-- forma de decir "ensename solo los sitios".
--
-- Dos funciones nuevas, y ninguna toca las existentes:
--
--   * `user_section_counts` dice **cuantas** hay de cada clase. La app la
--     necesita antes de pintar nada: una pestaña que se abre vacia es peor que
--     una pestaña que no esta, y quien no es tu amigo y solo tiene restaurantes
--     publicos tiene que ver una sola seccion, no tres con dos vacias.
--
--   * `user_entries_of` devuelve una sola clase, ordenada y filtrada por el
--     servidor.
--
-- ## Por que no se reutiliza `user_entries`
--
-- Porque hace una cosa que aqui esta mal: quita los platos que pertenecen a una
-- visita compartida y los sitios que ya salen por una visita. Eso es correcto
-- para un **feed** -- registrar una comida escribe sitio, visita y platos, y sin
-- esa poda la misma cena aparece tres veces seguidas -- y es exactamente lo que
-- no se quiere en una seccion llamada "Platos", donde faltarian justo los platos
-- de los que hay constancia. Una seccion es un catalogo, no una cronica.
--
-- ## Paginacion por desplazamiento y no por cursor
--
-- El resto de listas sociales pagina con `before` sobre una fecha, porque crecen
-- por arriba mientras las lees. Estas no: son el catalogo de otra persona, que
-- no cambia mientras lo miras, y ademas se pueden ordenar por nombre o por nota,
-- donde una fecha no nombra ninguna posicion. El coste de que una fila se mueva
-- si esa persona publica algo a mitad de scroll es una fila repetida; el de no
-- poder ordenar es no tener la funcion.

-- ── Cuantas hay de cada clase ────────────────────────────────────────────────
create or replace function user_section_counts(target uuid)
returns table (kind text, total bigint)
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
  )
  select 'visit'::text, count(*)
  from visits v cross join visible vis
  where v.deleted = false and v.user_id = target
    and effective_visibility(v.visibility, v.user_id, 'visit') = any (vis.levels)
  union all
  select 'dish', count(*)
  from dishes d cross join visible vis
  where d.deleted = false and d.user_id = target
    and effective_visibility(d.visibility, d.user_id, 'dish') = any (vis.levels)
  union all
  select 'restaurant', count(*)
  from restaurants r cross join visible vis
  where r.deleted = false and r.user_id = target
    and effective_visibility(r.visibility, r.user_id, 'restaurant') = any (vis.levels);
$$;

-- ── Una seccion ─────────────────────────────────────────────────────────────
-- Misma forma de fila que `feed_page` (0018), para que la app pinte estas
-- tarjetas con el mismo componente y no con un primo suyo.
-- Los parametros **no** pueden llamarse como las columnas que se devuelven:
-- `returns table (kind text, ...)` declara `kind` como parametro de salida, y un
-- `kind` de entrada con el mismo nombre hace que toda referencia sea ambigua y
-- la funcion ni siquiera se cree.
create or replace function user_entries_of(
  target uuid,
  entry_kind text,
  sort_by text default 'recent',
  min_stars int default null,
  page_index int default 0,
  rows_per_page int default 20
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
  with access as (select friendship_state(target) as state),
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
      v.created_at as occurred_at,
      -- El titulo de una visita es donde fue. Sin sitio legible, un rotulo
      -- neutro: una fila en blanco se lee como un fallo de carga.
      coalesce(r.name, 'Una visita') as title,
      r.name as place, null::int as rating, v.comments,
      -- La fecha de la comida manda sobre la de registro cuando existe: es la
      -- que la persona reconoce. Pero `visited_at` es texto en el espejo y las
      -- filas importadas de la v1 traen de todo, asi que se convierte solo lo
      -- que tiene forma de fecha -- un cast a secas revienta la consulta entera
      -- por una sola fila mal escrita.
      case
        when v.visited_at ~ '^\d{4}-\d{2}-\d{2}'
          then left(v.visited_at, 10)::date::timestamptz
        else v.created_at
      end as happened_at,
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
    from visits v
    cross join visible vis
    left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
    where entry_kind = 'visit' and v.deleted = false and v.user_id = target
      and effective_visibility(v.visibility, v.user_id, 'visit') = any (vis.levels)

    union all

    select 'dish', d.uuid, d.user_id, d.created_at, d.name, r.name, d.rating,
           d.comments, d.created_at, array[]::text[], 0::bigint, array[]::text[]
    from dishes d
    cross join visible vis
    left join restaurants r on r.uuid = d.restaurant_uuid and r.deleted = false
    where entry_kind = 'dish' and d.deleted = false and d.user_id = target
      and effective_visibility(d.visibility, d.user_id, 'dish') = any (vis.levels)

    union all

    select 'restaurant', r.uuid, r.user_id, r.created_at, r.name, null, r.rating,
           r.comments, r.created_at, array[]::text[], 0::bigint, array[]::text[]
    from restaurants r
    cross join visible vis
    where entry_kind = 'restaurant' and r.deleted = false and r.user_id = target
      and effective_visibility(r.visibility, r.user_id, 'restaurant') = any (vis.levels)
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
  -- Sin nota no es "cero estrellas": es que no se puntuo. Pedir "3 o mas" tiene
  -- que dejarlas fuera, no colocarlas al final.
  where min_stars is null or (e.rating is not null and e.rating >= min_stars)
  order by
    case when sort_by = 'name' then lower(e.title) end asc,
    case when sort_by = 'rating' then e.rating end desc nulls last,
    case when sort_by = 'oldest' then e.happened_at end asc,
    -- El desempate y el orden por defecto. `desc` en una sola expresion para
    -- que 'recent' no dependa del orden de las ramas de arriba.
    e.happened_at desc
  offset greatest(coalesce(page_index, 0), 0) * least(coalesce(rows_per_page, 20), 50)
  limit least(coalesce(rows_per_page, 20), 50);
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'user_section_counts(uuid)',
    'user_entries_of(uuid, text, text, int, int, int)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
