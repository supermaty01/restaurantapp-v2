-- Avisar de que te han etiquetado. Verificar con `npm run db:test`.
--
-- Hasta aqui una etiqueta llegaba en silencio: aparecia en "Contigo" si te
-- acordabas de mirar. Un aviso es lo que convierte eso en algo que te enteras
-- de que ha pasado.
--
-- La tabla es generica a proposito (`kind`) aunque hoy solo se emita una clase.
-- El coste de la columna es cero y el de partir en dos el dia que haya
-- solicitudes de amistad o comentarios no lo es: la pantalla, el contador y el
-- envio push se escriben una vez.

create table if not exists notifications (
  id bigint generated always as identity primary key,
  -- A quien se le avisa.
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tagged_in_visit')),
  -- Quien lo provoco. Nulo si algun dia hay avisos del sistema.
  actor_id uuid references auth.users (id) on delete cascade,
  visit_uuid uuid references visits (uuid) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Cuando salio como push. Nulo = pendiente de enviar; lo consume el Worker.
  pushed_at timestamptz
);

-- Idempotencia, y no es un detalle: el movil de quien etiqueta reenvia el
-- conjunto completo de participantes de cada visita en cada sync
-- (services/sync/links.ts), asi que el trigger de abajo se dispara una y otra
-- vez sobre la misma etiqueta. Sin esto, "Caro te etiquetó" reaparecia en cada
-- pasada de sincronizacion hasta volver la pantalla inservible.
create unique index if not exists notifications_once_idx
  on notifications (user_id, kind, visit_uuid)
  where visit_uuid is not null;

create index if not exists notifications_inbox_idx
  on notifications (user_id, created_at desc);

-- Para que el Worker encuentre lo que falta por enviar sin recorrer la tabla.
create index if not exists notifications_pending_push_idx
  on notifications (created_at)
  where pushed_at is null;

alter table notifications enable row level security;

-- Solo tuyas, y solo de lectura y marcado: nadie inserta avisos a mano desde el
-- cliente. Las escribe el trigger, que corre como definer.
create policy notifications_read on notifications
  for select
  using (user_id = auth.uid());

create policy notifications_mark on notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Quien emite el aviso ─────────────────────────────────────────────────────
-- En el insert de la etiqueta, no al leerla: asi el aviso queda escrito con la
-- fecha en la que ocurrio y sobrevive a que despues cambie la visibilidad o a
-- que la persona se desvincule de la cuenta.
create or replace function notify_tagged_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  author uuid;
begin
  select p.linked_user_id into target
  from people p
  where p.uuid = new.person_uuid and p.deleted = false;

  -- La mayoria de las personas con las que comes no usan la app.
  if target is null then
    return new;
  end if;

  select v.user_id into author from visits v where v.uuid = new.visit_uuid;

  -- Etiquetarte a ti mismo en tu propia comida no es una novedad.
  if author is null or author = target then
    return new;
  end if;

  insert into notifications (user_id, kind, actor_id, visit_uuid)
  values (target, 'tagged_in_visit', author, new.visit_uuid)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists visit_participant_notify on visit_participant;
create trigger visit_participant_notify
  after insert on visit_participant
  for each row
  execute function notify_tagged_person();

-- ── Lo que consume la app ────────────────────────────────────────────────────
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
    -- Un aviso de una etiqueta que ya rechazaste no es un aviso.
    and (n.visit_uuid is null or is_active_tag(n.visit_uuid, auth.uid()));
$$;

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
    coalesce(r.name, 'Una visita'),
    (
      select i.remote_key from images i
      where i.deleted = false and i.remote_key is not null
        and (i.visit_uuid = v.uuid or i.restaurant_uuid = r.uuid)
      order by (i.visit_uuid = v.uuid) desc, i.created_at
      limit 1
    )
  from notifications n
  left join profiles p on p.user_id = n.actor_id
  left join visits v on v.uuid = n.visit_uuid and v.deleted = false
  left join restaurants r on r.uuid = v.restaurant_uuid and r.deleted = false
  where n.user_id = auth.uid()
    -- Se cae de la lista si la visita se borro o si te quitaste de la etiqueta.
    and (n.visit_uuid is null or (v.uuid is not null and is_active_tag(n.visit_uuid, auth.uid())))
    and (before is null or n.created_at < before)
  order by n.created_at desc
  limit least(coalesce(page_size, 30), 50);
$$;

-- Marcar todo como leido de una vez. Un aviso que hay que descartar de uno en
-- uno es una tarea, no un aviso.
create or replace function mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

-- ── Fichas de push, todavia sin encender ─────────────────────────────────────
-- El envio necesita credenciales FCM en EAS, que no estan puestas. La tabla y
-- el registro se dejan hechos porque lo caro es decidir la forma, no escribirla:
-- cuando existan las credenciales, el movil llama a `register_push_token` y el
-- Worker recorre las notificaciones con `pushed_at is null`.
create table if not exists device_push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- El ExponentPushToken[...] del dispositivo.
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table device_push_tokens enable row level security;

create policy device_push_tokens_owner on device_push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function register_push_token(device_token text, device_platform text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into device_push_tokens (user_id, token, platform)
  values (auth.uid(), device_token, device_platform)
  on conflict (user_id, token) do nothing;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
do $$
begin
  execute 'revoke execute on function unread_notifications() from public';
  execute 'revoke execute on function notifications_page(timestamptz, int) from public';
  execute 'revoke execute on function mark_notifications_read() from public';
  execute 'revoke execute on function register_push_token(text, text) from public';

  execute 'grant execute on function unread_notifications() to authenticated';
  execute 'grant execute on function notifications_page(timestamptz, int) to authenticated';
  execute 'grant execute on function mark_notifications_read() to authenticated';
  execute 'grant execute on function register_push_token(text, text) to authenticated';
end;
$$;
