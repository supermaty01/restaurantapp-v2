-- Avisar de un me gusta. Verificar con `npm run db:test`.
--
-- La 0016 dejó la tabla genérica por `kind` y la 0019 cobró esa decisión con
-- tres clases nuevas sin tocar nada. Esta cuarta **sí** obliga a tocar algo, y
-- conviene decir por qué: es la primera que no ocurre en una visita.
--
-- Un me gusta puede ser a una visita, a un plato o a un sitio. La tabla solo
-- tenía `visit_uuid`, así que un aviso de me gusta a un plato no tenía dónde
-- apuntar — y sin eso el aviso no puede decir a qué le dieron ni abrirlo al
-- tocarlo, que son las dos cosas por las que existe.
--
-- ## Lo que se descartó
--
-- **Tres columnas anulables** (`visit_uuid`, `dish_uuid`, `restaurant_uuid`),
-- que es el patrón de `images`. Aquí no compensa: cada consulta tendría que
-- hacer tres `left join` y un `coalesce` para sacar un título, y la
-- idempotencia necesitaría tres índices únicos parciales en vez de uno.
--
-- **Reutilizar `visit_uuid` para todo**, que era la tentación barata. La
-- columna tiene una clave ajena a `visits`, así que meter ahí el uuid de un
-- plato no falla al escribirlo: falla al **borrar** el plato, porque el
-- `on delete cascade` no lo alcanza y el aviso queda apuntando a algo que ya no
-- existe. Un aviso que abre nada es peor que no avisar (0016).
--
-- Así que una pareja `entity_uuid` + `entity_kind`, sin clave ajena — igual que
-- `entry_likes` (0026) y por el mismo motivo, con el mismo precio anotado: un
-- borrado duro deja filas huérfanas, y `notification_visible` ya se encarga de
-- que no se vean.
--
-- `visit_uuid` se queda donde estaba. Las etiquetas siguen usándolo, tiene su
-- clave ajena y su índice de idempotencia, y reescribir eso para unificar sería
-- mover una cosa que funciona.

alter table notifications add column if not exists entity_uuid uuid;
alter table notifications add column if not exists entity_kind text;

alter table notifications drop constraint if exists notifications_entity_kind_check;
alter table notifications add constraint notifications_entity_kind_check
  check (entity_kind is null or entity_kind in ('visit', 'dish', 'restaurant'));

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in (
    'tagged_in_visit', 'friend_published', 'friend_request', 'friend_accepted', 'entry_liked'
  ));

/*
 * Un me gusta avisa **una vez y para siempre**, por persona y por entrada.
 *
 * Sin esto, quitar y volver a dar me gusta emite otro aviso, y eso es un timbre
 * que cualquiera puede tocar tantas veces como quiera desde el móvil de otra
 * persona. El aviso habla de que a alguien le gustó lo que escribiste, y eso
 * pasa una vez aunque el corazón se encienda y se apague.
 */
create unique index if not exists notifications_like_once_idx
  on notifications (user_id, kind, actor_id, entity_uuid)
  where entity_uuid is not null;

-- ── Que el aviso siga en pie ────────────────────────────────────────────────
--
-- **Se suelta la de cuatro argumentos antes de crear la de seis.** Un
-- `create or replace` con dos parámetros más no reemplaza: crea una sobrecarga,
-- y entonces `notification_visible(a, b, c, d)` deja de ser única y todas las
-- llamadas de la 0019 fallan con «function is not unique». Un fallo que solo
-- aparece al ejecutar la consulta, no al aplicar la migración.
--
-- Lo nuevo es la rama de `entry_liked`: vale mientras la
-- entrada exista y no esté borrada, que es la misma regla que ya cumplen las
-- etiquetas. Un me gusta a un plato que su dueño borró no tiene adónde llevar.
drop function if exists notification_visible(text, uuid, uuid, uuid);

create or replace function notification_visible(
  kind text, visit uuid, actor uuid, who uuid, entity uuid default null, entity_kind text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case kind
    when 'tagged_in_visit' then
      visit is not null
      and exists (select 1 from visits v where v.uuid = visit and v.deleted = false)
      and is_active_tag(visit, who)
    when 'friend_published' then
      actor is not null and are_friends(who, actor)
    when 'entry_liked' then
      entity is not null and case entity_kind
        when 'visit' then exists (select 1 from visits v where v.uuid = entity and v.deleted = false)
        when 'dish' then exists (select 1 from dishes d where d.uuid = entity and d.deleted = false)
        when 'restaurant' then
          exists (select 1 from restaurants r where r.uuid = entity and r.deleted = false)
        else false
      end
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
    and notification_visible(n.kind, n.visit_uuid, n.actor_id, auth.uid(), n.entity_uuid, n.entity_kind);
$$;

-- ── Quién emite el aviso ────────────────────────────────────────────────────
--
-- En el insert del me gusta, como todos los demás: así queda escrito con la
-- fecha en la que ocurrió y sobrevive a que después se quite.
--
-- No se avisa de lo propio. Darle me gusta a tu propia comida es perfectamente
-- razonable —es tu diario— pero un aviso tuyo sobre algo tuyo no es una
-- novedad.
create or replace function notify_entry_liked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  owner := case new.kind
    when 'visit' then (select v.user_id from visits v where v.uuid = new.entity_uuid)
    when 'dish' then (select d.user_id from dishes d where d.uuid = new.entity_uuid)
    when 'restaurant' then (select r.user_id from restaurants r where r.uuid = new.entity_uuid)
  end;

  if owner is null or owner = new.user_id then
    return new;
  end if;

  -- `on conflict do nothing` y no un `if not exists`: el índice único de arriba
  -- es quien manda, y comprobarlo antes deja una carrera entre dos me gusta
  -- simultáneos que el índice resolvería de todas formas con un error.
  insert into notifications (user_id, kind, actor_id, entity_uuid, entity_kind)
  values (owner, 'entry_liked', new.user_id, new.entity_uuid, new.kind)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists entry_likes_notify on entry_likes;
create trigger entry_likes_notify
  after insert on entry_likes
  for each row
  execute function notify_entry_liked();

-- ── La lista, que ahora tiene que titular tres clases de entrada ────────────
--
-- Antes el título salía siempre del restaurante de la visita. Un me gusta a un
-- plato tiene que decir el nombre del plato, y a un sitio el del sitio, o el
-- aviso queda en «a alguien le gustó» sin decir qué — que es la queja que trajo
-- esta ronda, dicha de otra forma.
-- Con `drop` delante: añadir columnas al `returns table` cambia el tipo de
-- retorno, y eso `create or replace` no lo permite. Los permisos se van con
-- ella y se reponen al final (0018 ya pagó ese olvido con un feed que
-- contestaba «permission denied» a todo el mundo).
drop function if exists notifications_page(timestamptz, int);

create function notifications_page(
  before timestamptz default null,
  page_size int default 30
)
returns table (
  id bigint, kind text, created_at timestamptz, read_at timestamptz,
  visit_uuid uuid, actor_id uuid, username text, display_name text,
  avatar_url text, title text, image_key text,
  entity_uuid uuid, entity_kind text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id, n.kind, n.created_at, n.read_at, n.visit_uuid, n.actor_id,
    p.username, p.display_name, p.avatar_url,
    case
      when n.visit_uuid is not null then coalesce(r.name, 'Una visita')
      when n.entity_uuid is not null then case n.entity_kind
        when 'visit' then coalesce(
          (select re.name from visits ve
             join restaurants re on re.uuid = ve.restaurant_uuid and re.deleted = false
           where ve.uuid = n.entity_uuid),
          'una visita')
        when 'dish' then (select d.name from dishes d where d.uuid = n.entity_uuid)
        when 'restaurant' then (select re.name from restaurants re where re.uuid = n.entity_uuid)
      end
    end,
    case
      when n.visit_uuid is not null then (
        select i.remote_key from images i
        where i.deleted = false and i.remote_key is not null
          and (i.visit_uuid = v.uuid or i.restaurant_uuid = r.uuid)
        order by (i.visit_uuid = v.uuid) desc nulls last, i.created_at
        limit 1
      )
      when n.entity_uuid is not null then (
        select i.remote_key from images i
        where i.deleted = false and i.remote_key is not null
          and (i.visit_uuid = n.entity_uuid or i.dish_uuid = n.entity_uuid
            or i.restaurant_uuid = n.entity_uuid)
        order by i.created_at
        limit 1
      )
    end,
    n.entity_uuid, n.entity_kind
  from notifications n
  left join profiles p on p.user_id = n.actor_id
  left join visits v on v.uuid = n.visit_uuid and v.deleted = false
  left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
  where n.user_id = auth.uid()
    and notification_visible(n.kind, n.visit_uuid, n.actor_id, auth.uid(), n.entity_uuid, n.entity_kind)
    and (before is null or n.created_at < before)
  order by n.created_at desc
  limit least(coalesce(page_size, 30), 50);
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'notifications_page(timestamptz, int)',
    'unread_notifications()',
    'notification_visible(text, uuid, uuid, uuid, uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
