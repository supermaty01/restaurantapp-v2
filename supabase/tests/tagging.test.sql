-- Etiquetado y visibilidad transitiva (0010–0011).
--
-- Run with `npm run db:test`. The runner applies every migration to a throwaway
-- database, so this exercises the real SQL from zero.
--
-- What is being pinned down: sharing a *visit* has to share enough of its
-- context to be worth anything. Before 0011, someone who kept their restaurants
-- private and shared a visit sent their friend a card that said "Una visita"
-- and nothing else — not where, not what they ate.

\set ON_ERROR_STOP on
\pset pager off

\set mateo    '''11111111-1111-1111-1111-111111111111'''
\set irene    '''22222222-2222-2222-2222-222222222222'''
\set caro     '''33333333-3333-3333-3333-333333333333'''
\set stranger '''44444444-4444-4444-4444-444444444444'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}'),
  (:irene, 'irene@example.com', '{}'),
  (:caro, 'caro@example.com', '{}'),
  (:stranger, 'nadie@example.com', '{}');

\set place  '''aaaaaaaa-0000-4000-8000-000000000001'''
\set plate  '''aaaaaaaa-0000-4000-8000-000000000002'''
\set meal   '''aaaaaaaa-0000-4000-8000-000000000003'''
\set person '''aaaaaaaa-0000-4000-8000-000000000004'''
\set solo   '''aaaaaaaa-0000-4000-8000-000000000005'''

-- Mateo's diary: a private restaurant, a private dish, and a visit he shares
-- with friends. This is exactly the shape the user described.
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:place, :mateo, 'Ichiran', 'private', now(), now());
insert into dishes (uuid, user_id, restaurant_uuid, name, price, visibility, created_at, updated_at)
  values (:plate, :mateo, :place, 'Tonkotsu', 12.50, 'private', now(), now());
insert into visits (uuid, user_id, restaurant_uuid, visited_at, comments, visibility, created_at, updated_at)
  values (:meal, :mateo, :place, '2026-05-01', 'Con Caro', 'friends', now(), now());
insert into dish_visit (user_id, visit_uuid, dish_uuid) values (:mateo, :meal, :plate);

-- Caro was there. Irene is only a friend.
insert into people (uuid, user_id, name, linked_user_id, username, created_at, updated_at)
  values (:person, :mateo, 'Caro', :caro, 'caro', now(), now());
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :meal, :person, 'pending');

-- A private visit, to prove the tag does not override the setting.
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:solo, :mateo, :place, '2026-05-02', 'private', now(), now());
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :solo, :person, 'pending');

set test.uid = :mateo;
select send_friend_request(:irene);
set test.uid = :irene;
select respond_friend_request(:mateo, true);

-- ── Being tagged is access in its own right ──────────────────────────────────
-- Caro is not Mateo's friend. She was at the meal, which is the whole reason
-- the tag exists: you get tagged because you were there.
set test.uid = :caro;
select expect_eq(friendship_state(:mateo), 'none', 'Caro is not a friend');
select expect_eq(can_read_visit(:meal), true, 'a tagged person can read the visit');
select expect_eq((select count(*)::int from tagged_visits()), 1, 'and finds it in her tray');

-- ── ...but it does not override the visibility setting ───────────────────────
select expect_eq(can_read_visit(:solo), false, 'a private visit stays private, tag or not');
select expect_eq(
  (select count(*)::int from tagged_visits() where entity_uuid = :solo), 0,
  'a private visit never reaches the tray');

-- ── A shared visit carries its restaurant and its dishes ─────────────────────
-- The point of the whole migration. Both rows are `private`; neither is
-- readable on its own, and both have to arrive with the visit anyway.
select expect_eq(
  (visit_detail(:meal) -> 'restaurant' ->> 'name'), 'Ichiran',
  'a private restaurant travels with the shared visit');
select expect_eq(
  json_array_length(visit_detail(:meal) -> 'dishes'), 1,
  'a private dish travels with the shared visit');
select expect_eq(
  (visit_detail(:meal) -> 'dishes' -> 0 ->> 'name'), 'Tonkotsu',
  'and it is the dish that was actually eaten');
select expect_eq(
  (visit_detail(:meal) -> 'dishes' -> 0 ->> 'price'), '12.50',
  'with its price, because that is what a shared dish is for');

-- The restaurant's own rating and comments do not ride along: those are an
-- opinion about the place in general, not about this meal.
select expect_eq(
  (visit_detail(:meal) -> 'restaurant' ->> 'comments'), null,
  'the private restaurant keeps its own notes to itself');

-- Who was there comes with it, or the visit cannot say what it is about.
select expect_eq(
  (visit_detail(:meal) -> 'people' -> 0 ->> 'name'), 'Caro',
  'the guest list travels too');
select expect_eq(
  (visit_detail(:meal) -> 'people' -> 0 ->> 'username'), 'caro',
  'with the handle, for a person who has an account');

-- ── A friend sees the same thing ─────────────────────────────────────────────
set test.uid = :irene;
select expect_eq(can_read_visit(:meal), true, 'a friend can read a friends-visible visit');
select expect_eq(
  (visit_detail(:meal) -> 'restaurant' ->> 'name'), 'Ichiran',
  'and gets the restaurant as well');
select expect_eq(
  (select count(*)::int from tagged_visits()), 0,
  'but a friend who was not there has an empty tray');

-- ── A stranger gets nothing ──────────────────────────────────────────────────
set test.uid = :stranger;
select expect_eq(can_read_visit(:meal), false, 'SECURITY: a stranger cannot read the visit');
-- json has no equality operator, so the check is on nullness itself.
select expect_eq(visit_detail(:meal) is null, true, 'SECURITY: and gets null, not a partial answer');
select expect_eq((select count(*)::int from tagged_visits()), 0, 'SECURITY: empty tray');

-- ── The owner always sees everything ─────────────────────────────────────────
set test.uid = :mateo;
select expect_eq(can_read_visit(:solo), true, 'the owner reads their own private visit');
select expect_eq(
  (visit_detail(:meal) -> 'restaurant' ->> 'comments'), null,
  'no comments were written, so none come back');
select expect_eq(
  (select count(*)::int from tagged_visits()), 0,
  'your own visits are never in your tray: they are already your diary');

-- ── Unfriending closes the friend door but not the tag door ──────────────────
set test.uid = :mateo;
select remove_friend(:irene);
set test.uid = :irene;
select expect_eq(can_read_visit(:meal), false, 'an ex-friend loses access');
set test.uid = :caro;
select expect_eq(can_read_visit(:meal), true, 'someone who was there keeps it');

\echo ''
\echo 'All tagging checks passed.'

-- ── El feed cuenta comidas, no filas (0012) ──────────────────────────────────
-- Mateo comparte todo lo de esta comida. La primera version del feed emitia una
-- tarjeta por fila y le mandaba tres a Irene por la misma cena.
set test.uid = :mateo;
select send_friend_request(:irene);
set test.uid = :irene;
select respond_friend_request(:mateo, true);

set test.uid = :mateo;
update restaurants set visibility = 'friends' where uuid = :place;
update dishes set visibility = 'friends' where uuid = :plate;

set test.uid = :irene;
select expect_eq(
  (select count(*)::int from feed_page()), 1,
  'una comida compartida entera es una sola tarjeta');
select expect_eq(
  (select kind from feed_page()), 'visit',
  'y la tarjeta es la visita, que es lo que de verdad pasó');
select expect_eq(
  (select dish_names[1] from feed_page()), 'Tonkotsu',
  'el plato viaja dentro de la visita, no en una tarjeta aparte');

-- Un plato suelto -- probado sin registrar una visita -- si merece su tarjeta.
\set loose '''aaaaaaaa-0000-4000-8000-000000000006'''
set test.uid = :mateo;
insert into dishes (uuid, user_id, restaurant_uuid, name, visibility, created_at, updated_at)
  values (:loose, :mateo, :place, 'Gyoza', 'friends', now(), now());

set test.uid = :irene;
select expect_eq((select count(*)::int from feed_page()), 2, 'un plato suelto si aparece');
select expect_eq(
  (select count(*)::int from feed_page() where kind = 'restaurant'), 0,
  'el restaurante no se repite: la visita ya lo contó');

-- ── Paginación ───────────────────────────────────────────────────────────────
select expect_eq(
  (select count(*)::int from feed_page(null, 1)), 1, 'page_size limita la página');
select expect_eq(
  (select count(*)::int from feed_page((select min(occurred_at) from feed_page()), 20)), 0,
  'before excluye lo ya visto');

\echo ''
\echo 'All feed checks passed.'
