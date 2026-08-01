-- El perfil de otra persona, repartido en secciones.
--
-- Hasta aquí `user_entries` devolvía las tres clases mezcladas en una sola lista
-- ordenada por fecha, que es lo que quiere el feed y no lo que quiere un perfil:
-- mirar el perfil de alguien es ir a buscar *sus sitios*, o *sus platos*, igual
-- que en el diario propio. Hacía falta poder pedir una clase, ordenarla y
-- filtrarla.
--
-- Y hacía falta saber **cuánto hay de cada una antes de pintar las pestañas**.
-- Sin eso, a quien no es tu amigo y solo tiene un par de sitios públicos se le
-- enseñarían tres pestañas con dos vacías, que es peor que no repartir nada: una
-- pestaña vacía se lee como «no ha compartido», y aquí significa «no te toca».
--
-- ## Qué se consideró y se descartó
--
-- **Paginar por cursor**, como `feed_page`. El cursor de allí funciona porque el
-- orden es siempre el mismo (`occurred_at desc`); aquí el orden lo elige quien
-- mira, así que harían falta tantas claves de cursor como criterios de orden, y
-- cada una con su desempate. Se pagina por desplazamiento a propósito: la lista
-- de una sección de un perfil es corta —lo que una persona ha compartido, no un
-- feed global— y el coste de `offset` se paga sobre decenas de filas.
--
-- **Filtrar en el cliente.** Es lo que había que evitar: para decidir si una
-- pestaña sobra hay que contar todo lo visible, y contarlo en el móvil obliga a
-- descargarlo todo primero. Un filtro que solo ve la página cargada además
-- miente sin fallar.
--
-- El reparto de acceso no cambia y no se reescribe: es el mismo `visible` de
-- 0014 —tú lo ves todo, un amigo ve lo suyo y lo público, un desconocido solo lo
-- público— extraído a `user_entries_all` para que las dos funciones nuevas y la
-- vieja no puedan divergir. Tres copias de una regla de acceso es como se
-- aflojan las reglas de acceso.

-- ── La base: todo lo que el que llama puede ver de esta persona ─────────────
--
-- Interna. No se concede a `authenticated`: quien llama entra por
-- `user_entries_page` o por `user_entry_counts`, que son las que aplican límite
-- de página. Las funciones de abajo son `security definer`, así que se ejecutan
-- como el dueño y pueden llamarla aunque quien las invocó no pueda.
create or replace function user_entries_all(target uuid)
returns table (
  kind text, entity_uuid uuid, author_id uuid, occurred_at timestamptz,
  title text, place text, rating int, comments text, dish_names text[],
  companion_count bigint
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
  )
  select
    'visit'::text, v.uuid, v.user_id, v.created_at,
    coalesce(r.name, 'Una visita'), r.name, null::int, v.comments,
    coalesce((
      select array_agg(d.name order by d.name)
      from dish_visit dv
      join dishes d on d.uuid = dv.dish_uuid and d.deleted = false
      where dv.visit_uuid = v.uuid
    ), array[]::text[]),
    (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid)
  from shared_visits v
  left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false

  union all

  -- Solo los platos sueltos: los que se comieron en una visita compartida ya
  -- viajan dentro de ella, y contarlos dos veces inflaría la pestaña.
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
$$;

-- ── Cuánto hay de cada clase ────────────────────────────────────────────────
--
-- Lo que decide qué pestañas existen. Devuelve siempre las tres filas, con cero
-- donde no haya nada: que el cliente tenga que distinguir «vino un cero» de «no
-- vino la fila» es cómo se acaba enseñando una pestaña vacía.
create or replace function user_entry_counts(target uuid)
returns table (kind text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select k.kind, coalesce(count(e.entity_uuid), 0)
  from unnest(array['visit', 'dish', 'restaurant']) as k(kind)
  left join user_entries_all(target) e on e.kind = k.kind
  group by k.kind;
$$;

-- ── Una página de una sección ───────────────────────────────────────────────
--
-- `kind_filter` nulo devuelve las tres, para que esto pueda sustituir a
-- `user_entries` sin que el cliente tenga que llamar a dos funciones distintas
-- según la pestaña.
--
-- `min_rating` no se aplica a las visitas: una visita no tiene nota propia —lo
-- que se puntúa es el sitio y el plato— así que filtrar por nota las escondería
-- todas. Es la misma decisión que toma el panel de filtros del diario, que no
-- ofrece la sección de nota cuando la lista es de visitas.
create or replace function user_entries_page(
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
  comments text, image_key text, dish_names text[], companion_count bigint
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
    e.dish_names, e.companion_count
  from user_entries_all(target) e
  join profiles p on p.user_id = e.author_id
  where (kind_filter is null or e.kind = kind_filter)
    and (min_rating is null or e.kind = 'visit' or coalesce(e.rating, 0) >= min_rating)
  order by
    -- Sin nota al final en los dos sentidos: «no puntuado» no es «cero», y
    -- tampoco es «lo mejor». Es una respuesta que no está.
    case when sort_by = 'rating' and descending then e.rating end desc nulls last,
    case when sort_by = 'rating' and not descending then e.rating end asc nulls last,
    -- `lower()` para que «Ávila» no caiga detrás de «zumo», que es donde la
    -- ordenación por bytes deja las mayúsculas y las tildes.
    case when sort_by = 'name' and descending then lower(e.title) end desc,
    case when sort_by = 'name' and not descending then lower(e.title) end asc,
    case when sort_by = 'date' and not descending then e.occurred_at end asc,
    -- Y este último sin condición de `sort_by`: es el desempate de todos los
    -- criterios. Sin él, dos platos con la misma nota pueden cambiar de sitio
    -- entre dos páginas y salir repetidos o no salir.
    e.occurred_at desc,
    e.entity_uuid
  offset greatest(coalesce(page_offset, 0), 0)
  limit least(coalesce(page_size, 20), 50);
$$;

do $$
declare
  fn text;
begin
  -- La base no se concede a nadie: solo entra por las dos de arriba, que son
  -- las que ponen el límite de página.
  execute 'revoke execute on function user_entries_all(uuid) from public';

  foreach fn in array array[
    'user_entry_counts(uuid)',
    'user_entries_page(uuid, text, text, boolean, int, int, int)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
