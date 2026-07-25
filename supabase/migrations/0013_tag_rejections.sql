-- Quitarse de una etiqueta ajena. Verificar con `npm run db:test`.
--
-- Etiquetar es algo que te hacen. Nadie te pregunta, y eso esta bien -- pedir
-- permiso convertiria "cene con Caro" en una negociacion --, pero tiene que
-- poder deshacerse. Sin esto, aparecer en la comida de otra persona es
-- definitivo, y la unica salida seria dejar de ser su amigo.
--
-- El sitio donde *no* puede vivir es visit_participant. Esa fila pertenece a
-- quien etiqueto: su movil manda el conjunto completo de participantes de cada
-- visita en cada sync (services/sync/links.ts), asi que borrar la fila o
-- marcarla 'rejected' aqui duraria hasta que esa persona volviera a abrir la
-- app. La retirada tiene que ser una fila *tuya*, que nadie mas escribe.

create table if not exists tag_rejections (
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_uuid uuid not null references visits (uuid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, visit_uuid)
);

alter table tag_rejections enable row level security;

create policy tag_rejections_owner on tag_rejections
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Estar etiquetado y no haberlo rechazado. Reemplaza el uso directo de
-- is_tagged_in en las puertas de lectura: la etiqueta sigue existiendo en el
-- diario de quien la puso -- no se le borra nada -- pero deja de darte acceso
-- y deja de aparecerte.
create or replace function is_active_tag(visit uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_tagged_in(visit, who)
    and not exists (
      select 1 from tag_rejections tr
      where tr.visit_uuid = visit and tr.user_id = who
    );
$$;

create or replace function reject_tag(visit uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into tag_rejections (user_id, visit_uuid)
  values (auth.uid(), visit)
  on conflict do nothing;
$$;

create or replace function restore_tag(visit uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from tag_rejections where user_id = auth.uid() and visit_uuid = visit;
$$;

-- ── Las puertas pasan a usar la version que respeta el rechazo ───────────────
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
        or vi.visibility = 'public'
        or (vi.visibility in ('friends', 'public') and are_friends(auth.uid(), vi.user_id))
        or (vi.visibility in ('friends', 'public') and is_active_tag(vi.uuid, auth.uid()))
      )
  );
$$;

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
    and is_active_tag(v.uuid, auth.uid())
    and (before is null or v.created_at < before)
  order by v.created_at desc
  limit least(coalesce(page_size, 20), 50);
$$;

-- La politica RLS de 0010 tambien: leer la visita por estar etiquetado deja de
-- valer en cuanto te retiras.
drop policy if exists visits_tagged_read on visits;
create policy visits_tagged_read on visits
  for select
  using (
    visibility in ('friends', 'public')
    and is_active_tag(uuid, auth.uid())
  );

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_active_tag(uuid, uuid)',
    'reject_tag(uuid)',
    'restore_tag(uuid)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
