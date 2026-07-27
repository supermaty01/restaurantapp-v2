-- Avisos de etiquetado (0016).
--
-- Run with `npm run db:test`. El runner aplica todas las migraciones sobre una
-- base desechable, así que esto ejercita el SQL real desde cero.
--
-- Lo que se fija aquí: que el aviso se emita una sola vez por etiqueta pase lo
-- que pase con el sync, y que desaparezca si la etiqueta deja de valer.

\set ON_ERROR_STOP on
\pset pager off

\set mateo '''11111111-1111-1111-1111-111111111111'''
\set caro  '''33333333-3333-3333-3333-333333333333'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}'),
  (:caro, 'caro@example.com', '{}');

\set place  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set meal   '''bbbbbbbb-0000-4000-8000-000000000002'''
\set person '''bbbbbbbb-0000-4000-8000-000000000003'''
\set selfie '''bbbbbbbb-0000-4000-8000-000000000004'''
\set nobody '''bbbbbbbb-0000-4000-8000-000000000005'''

insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:place, :mateo, 'Ichiran', 'friends', now(), now());
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:meal, :mateo, :place, '2026-05-01', 'friends', now(), now());

-- ── Nadie tiene avisos antes de que pase nada ────────────────────────────────
set test.uid = :caro;
select expect_eq(unread_notifications(), 0, 'la bandeja empieza vacía');

-- ── Etiquetar emite el aviso ─────────────────────────────────────────────────
set test.uid = :mateo;
insert into people (uuid, user_id, name, linked_user_id, username, created_at, updated_at)
  values (:person, :mateo, 'Caro', :caro, 'caro', now(), now());
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :meal, :person, 'pending');

set test.uid = :caro;
select expect_eq(unread_notifications(), 1, 'etiquetar a alguien le avisa');
select expect_eq(
  (select kind from notifications_page()), 'tagged_in_visit', 'y dice de qué clase es');
select expect_eq(
  (select display_name from notifications_page() where kind = 'tagged_in_visit'),
  null, 'sin nombre puesto, el perfil aún no lo tiene');
select expect_eq(
  (select title from notifications_page()), 'Ichiran', 'y dónde fue');

-- Quien etiqueta no se avisa a sí mismo.
set test.uid = :mateo;
select expect_eq(unread_notifications(), 0, 'quien etiqueta no recibe su propio aviso');

-- ── El sync reenvía los participantes y NO duplica ───────────────────────────
-- El móvil de quien etiqueta manda el conjunto completo de participantes de
-- cada visita en cada pasada. Sin el índice único, el aviso reaparecería en
-- cada sincronización.
set test.uid = :mateo;
delete from visit_participant where visit_uuid = :meal;
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :meal, :person, 'pending');
delete from visit_participant where visit_uuid = :meal;
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :meal, :person, 'pending');

set test.uid = :caro;
select expect_eq(unread_notifications(), 1, 'tres syncs de la misma etiqueta siguen siendo un aviso');

-- ── Marcar como leído ────────────────────────────────────────────────────────
select mark_notifications_read();
select expect_eq(unread_notifications(), 0, 'marcar como leído vacía el contador');
select expect_eq(
  (select count(*)::int from notifications_page()), 1,
  'pero el aviso sigue en la lista: leído no es borrado');

-- ── Quitarse de la etiqueta retira el aviso ──────────────────────────────────
select reject_tag(:meal);
select expect_eq(
  (select count(*)::int from notifications_page()), 0,
  'quitarse de la etiqueta se lleva el aviso con ella');

-- ── Una persona sin cuenta no genera nada ────────────────────────────────────
-- La mayoría de las personas con las que comes no usan la app.
set test.uid = :mateo;
insert into people (uuid, user_id, name, created_at, updated_at)
  values (:nobody, :mateo, 'Alguien del trabajo', now(), now());
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :meal, :nobody, 'pending');
select expect_eq(
  (select count(*)::int from notifications), 1,
  'etiquetar a quien no tiene cuenta no escribe ningún aviso');

-- ── Etiquetarte a ti mismo no es una novedad ─────────────────────────────────
insert into people (uuid, user_id, name, linked_user_id, username, created_at, updated_at)
  values (:selfie, :mateo, 'Yo', :mateo, 'mateo', now(), now());
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :meal, :selfie, 'pending');
select expect_eq(unread_notifications(), 0, 'etiquetarte en tu propia comida no te avisa');

-- ── SEGURIDAD: los avisos son de quien son ───────────────────────────────────
-- La única fila que existe es la de Caro. Bajo RLS, ella la ve y Mateo no.
set role authenticated;
set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications), 1,
  'cada quien ve sus avisos');
set test.uid = :mateo;
select expect_eq(
  (select count(*)::int from notifications), 0,
  'SEGURIDAD: y no los de nadie más, ni siquiera quien los provocó');
reset role;

\echo ''
\echo 'All notification checks passed.'
