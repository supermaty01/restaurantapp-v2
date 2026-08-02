-- Las secciones del perfil vuelven a tener contenido. Verificar con `npm run db:test`.
--
-- ## El sintoma
--
-- «El perfil de alguien mas agrupa todo por visitas y no puedo buscar los platos
-- o los restaurantes individualmente. En mi cuenta parece funcionar.»
--
-- Las dos mitades de esa frase son la pista entera, y apuntan a la regla que
-- 0022 heredo del feed sin volver a preguntarse si alli seguia valiendo.
--
-- ## Que pasaba
--
-- `user_entries_all` excluia los platos que se comieron en una visita compartida
-- («solo los platos sueltos») y los sitios donde ocurrio una visita compartida.
-- La regla viene de `feed_page` (0012) y **alli es correcta**: el feed es una
-- sola lista cronologica, y una comida que escribe el sitio, la visita y tres
-- platos produciria cinco tarjetas seguidas contando lo mismo.
--
-- Un perfil no es una lista cronologica: son tres pestañas, y la pestaña
-- «Platos» tiene que contestar «que ha comido esta persona». Con la regla del
-- feed puesta, cada plato que se apunta *dentro de una comida* desaparecia de
-- ella. Y como registrar una visita con sus platos es el camino normal de la
-- app, a quien la usa asi le quedaban las dos pestañas del catalogo vacias —y
-- 0022 esconde las secciones vacias a proposito, asi que ni siquiera salian:
-- **el perfil entero se veia como una lista de visitas**.
--
-- Eso explica tambien por que en el diario propio del autor «parecia
-- funcionar»: quien tiene ademas platos y sitios sueltos —apuntados sin visita—
-- si ve las tres pestañas, solo que incompletas. El sintoma cambia de forma
-- segun como use la app cada persona, que es por lo que se leia como un fallo
-- de otra cosa.
--
-- ## Que se hace
--
-- Quitar la exclusion, **solo aqui**. `feed_page` no se toca: su lista sigue
-- siendo una, y alli el pliegue sigue siendo lo correcto.
--
-- El reparto de acceso no cambia ni una linea: un plato sigue apareciendo solo
-- si su propia visibilidad lo permite. Que su visita sea publica no hace publico
-- el plato — eso es transitivo solo dentro del detalle de la visita (0011), que
-- es una decision distinta y se queda como esta.
--
-- ## Lo que esto le hace a los numeros de las pestañas
--
-- Los sube, y es lo que se quiere: «Platos 24» pasa a significar «esta persona
-- ha compartido 24 platos» en vez de «24 platos que no estan en ninguna comida»,
-- que no es una pregunta que nadie se haga. `user_entry_counts` sale de la misma
-- funcion, asi que el numero y la lista no pueden discrepar.

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

  -- Todos los platos compartidos, tambien los que se comieron en una visita.
  -- La pestaña «Platos» contesta «que ha comido», y un plato apuntado dentro de
  -- una comida es exactamente eso.
  select 'dish', d.uuid, d.user_id, d.created_at, d.name, r.name, d.rating,
         d.comments, array[]::text[], 0::bigint
  from dishes d
  cross join visible vis
  left join restaurants r on r.uuid = d.restaurant_uuid and r.deleted = false
  where d.deleted = false and d.user_id = target
    and effective_visibility(d.visibility, d.user_id, 'dish') = any (vis.levels)

  union all

  select 'restaurant', r.uuid, r.user_id, r.created_at, r.name, null, r.rating,
         r.comments, array[]::text[], 0::bigint
  from restaurants r
  cross join visible vis
  where r.deleted = false and r.user_id = target
    and effective_visibility(r.visibility, r.user_id, 'restaurant') = any (vis.levels)
$$;

-- Se mantiene fuera del alcance de quien llama: se entra por `user_entries_page`
-- o por `user_entry_counts`, que son las que ponen el limite de pagina. Un
-- `create or replace` conserva los permisos, pero dejarlo escrito evita que la
-- proxima migracion que la reescriba se los devuelva sin querer.
revoke execute on function user_entries_all(uuid) from public;
