-- La foto de una visita etiquetada, y con quien fuiste (0018).
--
-- Run with `npm run db:test`.
--
-- Lo que se fija: que gane la foto de la visita cuando la hay, aunque el
-- restaurante tenga la suya. El `order by ... desc` decia justo eso y hacia lo
-- contrario, porque `i.visit_uuid = v.uuid` da NULL para una foto de
-- restaurante y `DESC` ordena NULLS FIRST.

\set ON_ERROR_STOP on
\pset pager off

\set mateo '''11111111-1111-1111-1111-111111111111'''
\set caro  '''33333333-3333-3333-3333-333333333333'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}'),
  (:caro, 'caro@example.com', '{}');

\set place   '''dddddddd-0000-4000-8000-000000000001'''
\set meal    '''dddddddd-0000-4000-8000-000000000002'''
\set caroP   '''dddddddd-0000-4000-8000-000000000003'''
\set moniP   '''dddddddd-0000-4000-8000-000000000004'''
\set imgRest '''dddddddd-0000-4000-8000-000000000005'''
\set imgMeal '''dddddddd-0000-4000-8000-000000000006'''

insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:place, :mateo, 'Bunker burger', 'friends', now(), now());
insert into visits (uuid, user_id, restaurant_uuid, visited_at, comments, visibility, created_at, updated_at)
  values (:meal, :mateo, :place, '2026-07-24', 'Salida a comer', 'friends', now(), now());

-- La del restaurante se subio ANTES, para que ganar por fecha no explique nada:
-- si sale esta, es por el orden de la comparacion y no por `created_at`.
insert into images (uuid, user_id, remote_key, restaurant_uuid, created_at, updated_at)
  values (:imgRest, :mateo, 'clave-fachada', :place,
          now() - interval '2 days', now() - interval '2 days');
insert into images (uuid, user_id, remote_key, visit_uuid, created_at, updated_at)
  values (:imgMeal, :mateo, 'clave-mesa', :meal, now(), now());

-- Caro esta etiquetada, y ademas fue Moni, que no tiene cuenta.
insert into people (uuid, user_id, name, linked_user_id, username, created_at, updated_at)
  values (:caroP, :mateo, 'Caro', :caro, 'caro', now(), now());
insert into people (uuid, user_id, name, created_at, updated_at)
  values (:moniP, :mateo, 'Moni', now(), now());
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status) values
  (:mateo, :meal, :caroP, 'pending'),
  (:mateo, :meal, :moniP, 'pending');

-- ── La foto ──────────────────────────────────────────────────────────────────
set test.uid = :caro;
select expect_eq(
  (select image_key from tagged_visits() where entity_uuid = :meal),
  'clave-mesa',
  'gana la foto de la visita, no la fachada del restaurante');

-- ── Con quien ────────────────────────────────────────────────────────────────
-- Caro es quien mira, asi que la lista son *los demas*: ella ya sabe que estuvo.
select expect_eq(
  (select array_to_string(companion_names, ', ') from tagged_visits() where entity_uuid = :meal),
  'Moni',
  'los nombres viajan, y quien mira no se lista a si misma');

-- El conteo no cambia: sigue siendo el total de la mesa, que es otra pregunta.
select expect_eq(
  (select companion_count::int from tagged_visits() where entity_uuid = :meal), 2,
  'el conteo sigue contando a todos');

-- ── Sin foto propia, cae en la del restaurante ───────────────────────────────
-- El fallback existe a proposito: una visita sin foto es mejor con la fachada
-- del sitio que con un hueco gris.
update images set deleted = true, updated_at = now() where uuid = :imgMeal;
select expect_eq(
  (select image_key from tagged_visits() where entity_uuid = :meal),
  'clave-fachada',
  'si la visita no tiene foto, vale la del restaurante');

\echo ''
\echo 'All tagged photo checks passed.'
