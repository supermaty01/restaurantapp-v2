-- Etiquetar personas de verdad. Verificar con `npm run db:test`.
--
-- `people.linked_user_id` existia desde 0001 y nunca se rellenaba: el cliente
-- no tenia forma de decir "esta persona es esta cuenta". Ahora si, y con ello
-- una visita compartida puede llegarle a quien estuvo en ella.

-- El @handle en el momento de etiquetar. Redundante a proposito: permite pintar
-- la etiqueta sin pedir el perfil, y un handle que despues cambio es un
-- problema menor que un chip que no sabe dibujarse.
alter table people
  add column if not exists username text;

comment on column people.linked_user_id is
  'La cuenta a la que apunta esta persona, si apunta a alguna. Nula es lo normal: '
  'la mayoria de las personas con las que comes no usan la app.';

-- ── Quien esta etiquetado puede leer la visita ───────────────────────────────
-- Estar etiquetado en una visita es una forma de acceso por derecho propio,
-- distinta de la amistad: te etiquetan porque estuviste alli. Sin esto, la
-- etiqueta seria una anotacion privada en el diario de otra persona.
create or replace function is_tagged_in(visit uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from visit_participant vp
    join people p on p.uuid = vp.person_uuid
    where vp.visit_uuid = visit
      and p.linked_user_id = who
      and p.deleted = false
  );
$$;

create policy visits_tagged_read on visits
  for select
  using (
    visibility in ('friends', 'public')
    and is_tagged_in(uuid, auth.uid())
  );

-- La persona etiquetada tambien tiene que poder leer la fila que la etiqueta,
-- o la visita llegaria sin poder decir con quien fue.
create policy visit_participant_tagged_read on visit_participant
  for select
  using (is_tagged_in(visit_uuid, auth.uid()));

create policy people_tagged_read on people
  for select
  using (linked_user_id = auth.uid());

create index if not exists people_linked_user_idx on people (linked_user_id)
  where linked_user_id is not null;

create index if not exists visit_participant_person_idx on visit_participant (person_uuid);

do $$
begin
  execute 'revoke execute on function is_tagged_in(uuid, uuid) from public';
  execute 'grant execute on function is_tagged_in(uuid, uuid) to authenticated';
end;
$$;
