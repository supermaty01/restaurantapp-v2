-- Etiquetar a alguien es compartir con esa persona. Verificar con `npm run db:test`.
--
-- Hasta aqui una etiqueta solo abria la puerta si *ademas* la visita estaba
-- marcada como compartida (`is_shared`). El resultado era que etiquetar a
-- alguien en una comida privada no hacia nada: la persona salia en la lista de
-- participantes del diario de quien la etiqueto y nunca se enteraba. La accion
-- mas explicita que hay -- decir "estuviste aqui conmigo" -- quedaba anulada por
-- un ajuste que ni siquiera habla de ella.
--
-- Las dos cosas son decisiones distintas y hay que dejar de mezclarlas:
--
--   * `visibility` responde "quien lo ve en su feed". Es un reparto a un
--     publico que no eliges uno a uno.
--   * una etiqueta responde "con quien estuve". Es un destinatario concreto,
--     nombrado a mano, y es en si misma el acto de compartir.
--
-- Asi que a partir de aqui la etiqueta abre la puerta por si sola, tambien en
-- 'private'. Lo que NO cambia es el feed: `feed_page` sigue pidiendo
-- `is_shared`, asi que una visita privada le llega a quien etiquetaste a su
-- bandeja "Contigo" y no se cuela en el feed de nadie. Esa es exactamente la
-- diferencia que se pedia -- verla en tus etiquetas aunque no la veas en el
-- feed.
--
-- Sigue habiendo salida: `tag_rejections` (0013) deja que quien no quiere estar
-- etiquetado se quite, y `is_active_tag` ya lo respeta.

-- ── La politica de lectura ───────────────────────────────────────────────────
drop policy if exists visits_tagged_read on visits;
create policy visits_tagged_read on visits
  for select
  using (is_active_tag(uuid, auth.uid()));

-- ── Las tres puertas para leer una visita ────────────────────────────────────
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
        or effective_visibility(vi.visibility, vi.user_id, 'visit') = 'public'
        -- De un amigo, y repartida a los amigos.
        or (
          is_shared(vi.visibility, vi.user_id, 'visit')
          and are_friends(auth.uid(), vi.user_id)
        )
        -- Estabas alli. Sin condicion de visibilidad: quien te etiqueto ya
        -- decidio, al escribir tu nombre, que esta comida es tambien tuya.
        or is_active_tag(vi.uuid, auth.uid())
      )
  );
$$;

-- ── La bandeja "Contigo" ─────────────────────────────────────────────────────
create or replace function tagged_visits(
  before timestamptz default null,
  page_size int default 20
)
returns table (
  entity_uuid uuid, author_id uuid, username text, display_name text,
  avatar_url text, occurred_at timestamptz, visited_at text, title text,
  comments text, image_key text, companion_count bigint
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
      order by (i.visit_uuid = v.uuid) desc, i.created_at
      limit 1
    ),
    (select count(*) from visit_participant vp where vp.visit_uuid = v.uuid)
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
