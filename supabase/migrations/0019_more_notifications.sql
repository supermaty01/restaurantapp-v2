-- Tres clases mas de aviso. Verificar con `npm run db:test`.
--
-- La 0016 dejo la tabla generica por `kind` a proposito, y esto es el cobro de
-- aquella decision: son dos triggers y cuatro textos, sin tocar el espejo, sin
-- tocar el envio push y sin una tabla nueva.
--
--   friend_request   alguien quiere ser tu amigo
--   friend_accepted  aceptaron la solicitud que mandaste
--   friend_published un amigo ha añadido algo que puedes ver
--
-- Descartada a proposito una cuarta, «un amigo ha visitado un sitio que
-- puntuaste alto»: depende de que dos personas registren el mismo local -- misma
-- sede, mismo nombre, escrito igual -- y eso no se puede dar por hecho.

-- ── Las clases nuevas ────────────────────────────────────────────────────────
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('tagged_in_visit', 'friend_published', 'friend_request', 'friend_accepted'));

-- Lo que consulta el silencio de diez minutos de mas abajo, una vez por amigo y
-- por fila publicada. Sin indice eso recorre la tabla entera de avisos.
create index if not exists notifications_actor_recent_idx
  on notifications (user_id, actor_id, created_at desc);

-- ── Que un aviso siga en pie ─────────────────────────────────────────────────
-- Una sola funcion porque hasta ahora la regla estaba escrita dos veces -- en
-- `notifications_page` y en `unread_notifications` -- y ya no coincidian: el
-- contador no miraba si la visita seguia existiendo, asi que una visita borrada
-- dejaba el punto encendido sobre una lista vacia. Un punto que no se apaga
-- mirando es peor que no tener punto.
create or replace function notification_visible(
  kind text, visit uuid, actor uuid, who uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case kind
    -- La etiqueta tiene que seguir viva y la visita sin borrar.
    when 'tagged_in_visit' then
      visit is not null
      and exists (select 1 from visits v where v.uuid = visit and v.deleted = false)
      and is_active_tag(visit, who)
    -- Deja de valer si dejasteis de ser amigos: apunta a un perfil cuyo
    -- contenido ya no se puede leer.
    when 'friend_published' then
      actor is not null and are_friends(who, actor)
    -- Las dos de amistad hablan de la relacion, no de contenido. Se quedan como
    -- historia aunque despues os desagregueis, igual que un aviso leido no se
    -- borra.
    else true
  end;
$$;

create or replace function unread_notifications()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from notifications n
  where n.user_id = auth.uid()
    and n.read_at is null
    and notification_visible(n.kind, n.visit_uuid, n.actor_id, auth.uid());
$$;

-- Mismo contrato de columnas que en la 0016: la app ya las lee todas. Lo que
-- cambia es que `title` e `image_key` solo tienen sentido cuando el aviso lleva
-- una visita, y ahora salen nulos cuando no la lleva en vez de 'Una visita',
-- que era mentira para una solicitud de amistad.
--
-- Y le llega el `nulls last` de la 0018. Aquella migracion arreglo el mismo
-- fallo en `tagged_visits` y esta copia se quedo atras: `(i.visit_uuid =
-- v.uuid) desc` da NULL para una foto de restaurante, y Postgres ordena NULLS
-- FIRST en DESC, asi que el aviso enseñaba la fachada del sitio en vez de la
-- comida. Mismo bicho, segundo nido.
create or replace function notifications_page(
  before timestamptz default null,
  page_size int default 30
)
returns table (
  id bigint, kind text, created_at timestamptz, read_at timestamptz,
  visit_uuid uuid, actor_id uuid, username text, display_name text,
  avatar_url text, title text, image_key text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id, n.kind, n.created_at, n.read_at, n.visit_uuid, n.actor_id,
    p.username, p.display_name, p.avatar_url,
    case when n.visit_uuid is not null then coalesce(r.name, 'Una visita') end,
    case when n.visit_uuid is not null then (
      select i.remote_key from images i
      where i.deleted = false and i.remote_key is not null
        and (i.visit_uuid = v.uuid or i.restaurant_uuid = r.uuid)
      order by (i.visit_uuid = v.uuid) desc nulls last, i.created_at
      limit 1
    ) end
  from notifications n
  left join profiles p on p.user_id = n.actor_id
  left join visits v on v.uuid = n.visit_uuid and v.deleted = false
  left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
  where n.user_id = auth.uid()
    and notification_visible(n.kind, n.visit_uuid, n.actor_id, auth.uid())
    and (before is null or n.created_at < before)
  order by n.created_at desc
  limit least(coalesce(page_size, 30), 50);
$$;

-- ── Amistad: la solicitud y la respuesta ─────────────────────────────────────
-- En la tabla y no dentro de `send_friend_request` / `respond_friend_request`
-- porque hay dos caminos hasta «ahora sois amigos»: responder que si, y mandar
-- una solicitud a quien ya te la habia mandado, que la RPC acepta en el sitio.
-- Escrito en el trigger, los dos caminos avisan igual y no hay un tercero que
-- se quede sin avisar el dia que lo haya.
create or replace function notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- El miembro del par que no pidio la amistad.
  other uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into notifications (user_id, kind, actor_id)
      values (other, 'friend_request', new.requested_by);
    end if;
    return new;
  end if;

  -- Solo el salto, no cada escritura que deje la fila en 'accepted'.
  if old.status = 'pending' and new.status = 'accepted' then
    -- Se avisa a quien la mando, y quien acepto es el otro.
    insert into notifications (user_id, kind, actor_id)
    values (new.requested_by, 'friend_accepted', other);
  end if;

  return new;
end;
$$;

drop trigger if exists friendships_notify on friendships;
create trigger friendships_notify
  after insert or update on friendships
  for each row
  execute function notify_friendship();

-- ── Un amigo ha publicado algo ───────────────────────────────────────────────
-- Con dos frenos, porque esta es la unica clase que se emite sola y en volumen.
--
-- 1. **Silencio de diez minutos por persona.** Registrar una comida entera crea
--    el restaurante, la visita y los platos, tres filas seguidas, y de ahi tiene
--    que salir un aviso y no tres. Se mira si ya hubo alguno *de ese amigo* hace
--    poco, sea de la clase que sea: si acaba de etiquetarte, ya te enteraste de
--    que ha añadido algo, y repetirlo en generico sobra.
--
--    Gana el **primero**, no el ultimo. Es lo que hace que el aviso llegue
--    cuando la cosa pasa y no cuando se termina de escribir.
--
-- 2. **Lo viejo no avisa.** `created_at` lo pone el movil al crear la fila, no
--    el servidor al recibirla, asi que iniciar sesion por primera vez sube un
--    diario de años de golpe. Sin este freno, todos tus amigos reciben «ha
--    añadido algo nuevo» por una comida de 2023. Siete dias deja pasar el caso
--    real que hay que respetar -- un movil sin cobertura una semana de viaje,
--    que es justo cuando mas se registra -- y para el volcado historico.
--
-- Solo al insertar. Cambiar el ajuste general de privacidad vuelve visibles de
-- golpe todas las entradas en 'default' (0014), y avisar de eso seria mandar un
-- aviso por cada amigo cada vez que alguien toca un interruptor.
create or replace function notify_friend_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity text := case tg_table_name
    when 'visits' then 'visit'
    when 'dishes' then 'dish'
    when 'restaurants' then 'restaurant'
  end;
  target uuid;
begin
  if new.deleted then
    return new;
  end if;

  -- Nunca la columna a pelo: en 'default' la respuesta esta en los ajustes de
  -- quien la escribio, y se resuelve al leer (0014).
  if not is_shared(new.visibility, new.user_id, entity) then
    return new;
  end if;

  if new.created_at < now() - interval '7 days' then
    return new;
  end if;

  for target in
    select case when f.user_a = new.user_id then f.user_b else f.user_a end
    from friendships f
    where f.status = 'accepted'
      and new.user_id in (f.user_a, f.user_b)
  loop
    if exists (
      select 1 from notifications n
      where n.user_id = target
        and n.actor_id = new.user_id
        and n.created_at > now() - interval '10 minutes'
    ) then
      continue;
    end if;

    -- Sin `visit_uuid` incluso cuando lo dispara una visita: el aviso resume una
    -- rafaga de filas, y apuntar a la que gano la carrera seria apuntar a un
    -- sitio distinto segun el orden en que subio el sync. El destino que vale
    -- para las tres es el perfil de quien publico, que es donde estan todas.
    insert into notifications (user_id, kind, actor_id)
    values (target, 'friend_published', new.user_id);
  end loop;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['restaurants', 'dishes', 'visits'] loop
    execute format('drop trigger if exists %I on %I', t || '_notify_published', t);
    execute format(
      'create trigger %I after insert on %I for each row execute function notify_friend_published()',
      t || '_notify_published', t
    );
  end loop;
end;
$$;

-- ── De paso: 'dishe' no es una entidad ───────────────────────────────────────
-- La 0014 monto las tres policies en un bucle y saco el nombre de la entidad
-- con `left(t, length(t) - 1)`, que sobre 'dishes' da 'dishe'. Y
-- `effective_visibility` resuelve con un `case` sin rama para eso: devuelve
-- NULL, el coalesce lo vuelve 'private', y **todo plato en 'default' quedaba
-- ilegible para tus amigos** por mucho que el ajuste dijera que si.
--
-- No se nota hoy porque nada lee `dishes` de otra persona por RLS -- el feed, el
-- perfil ajeno y el detalle de una visita van por RPC security definer, y esas
-- si escriben 'dish'. Es una mina, no una averia: se nota el dia que alguien
-- consulte la tabla directamente y le vuelva vacia sin error.
drop policy if exists dishes_friend_read on dishes;
create policy dishes_friend_read on dishes
  for select
  using (is_shared(visibility, user_id, 'dish') and are_friends(auth.uid(), user_id));

-- ── Permisos ─────────────────────────────────────────────────────────────────
do $$
begin
  execute 'revoke execute on function notification_visible(text, uuid, uuid, uuid) from public';
  execute 'grant execute on function notification_visible(text, uuid, uuid, uuid) to authenticated';
end;
$$;
