-- Avisos de amistad y de publicacion (0019).
--
-- Run with `npm run db:test`. Fichero aparte del de etiquetado a proposito: el
-- runner levanta una base por fichero, y estas comprobaciones cuentan filas de
-- `notifications` que las de alla darian por buenas al reves.
--
-- Lo que se fija aqui: que una comida entera produzca **un** aviso y no tres,
-- que el que sale sea el primero, que un diario historico recien subido no
-- despierte a nadie, y que 'default' se resuelva contra los ajustes.
--
-- El paso del tiempo se simula envejeciendo `notifications.created_at` hacia
-- atras. Es lo unico que mira el silencio de diez minutos, y esperar de verdad
-- convertiria la suite en algo que nadie corre.

\set ON_ERROR_STOP on
\pset pager off

\set mateo '''11111111-1111-1111-1111-111111111111'''
\set caro  '''22222222-2222-2222-2222-222222222222'''
\set moni  '''33333333-3333-3333-3333-333333333333'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}'),
  (:caro, 'caro@example.com', '{}'),
  (:moni, 'moni@example.com', '{}');

-- ── Una solicitud avisa a quien la recibe ────────────────────────────────────
set test.uid = :mateo;
select send_friend_request(:caro);

set test.uid = :caro;
select expect_eq(unread_notifications(), 1, 'una solicitud de amistad avisa');
select expect_eq(
  (select kind from notifications_page()), 'friend_request', 'y dice de que clase es');
select expect_eq(
  (select actor_id from notifications_page()), :mateo, 'con quien la manda');
select expect_eq(
  (select title from notifications_page()), null,
  'sin titulo: una solicitud no ocurre en ningun restaurante');

-- Quien la manda no se avisa a si mismo.
set test.uid = :mateo;
select expect_eq(unread_notifications(), 0, 'quien pide la amistad no recibe su propio aviso');

-- ── Aceptar avisa a quien la mando ───────────────────────────────────────────
set test.uid = :caro;
select respond_friend_request(:mateo, true);

set test.uid = :mateo;
select expect_eq(unread_notifications(), 1, 'aceptar avisa a quien la mando');
select expect_eq(
  (select kind from notifications_page()), 'friend_accepted', 'y dice que fue una aceptacion');
select expect_eq(
  (select actor_id from notifications_page()), :caro, 'el actor es quien acepto, no quien pidio');

-- Y no se avisa dos veces a quien acepto.
set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_accepted'), 0,
  'quien acepta no recibe aviso de su propia aceptacion');

-- ── Registrar una comida entera produce UN aviso ─────────────────────────────
-- Tres filas seguidas -- restaurante, visita, plato -- que es exactamente lo que
-- escribe el movil al guardar una comida.
update notifications set created_at = created_at - interval '1 hour';

\set place '''bbbbbbbb-0000-4000-8000-000000000001'''
\set meal  '''bbbbbbbb-0000-4000-8000-000000000002'''
\set plate '''bbbbbbbb-0000-4000-8000-000000000003'''

set test.uid = :mateo;
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:place, :mateo, 'Ichiran', 'friends', now(), now());

-- Comprobado aqui, antes de las otras dos filas: el aviso es el primero y no el
-- ultimo, que es lo que hace que llegue cuando la cosa pasa.
set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 1,
  'el aviso sale con la primera fila, sin esperar a la comida entera');

set test.uid = :mateo;
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:meal, :mateo, :place, '2026-07-20', 'friends', now(), now());
insert into dishes (uuid, user_id, restaurant_uuid, name, visibility, created_at, updated_at)
  values (:plate, :mateo, :place, 'Ramen', 'friends', now(), now());

set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 1,
  'y las otras dos filas de la misma comida no añaden un aviso mas');
select expect_eq(
  (select visit_uuid from notifications_page() where kind = 'friend_published'), null,
  'no apunta a una fila concreta: resume una rafaga, y lleva al perfil');

-- ── Pasado el silencio, otra comida vuelve a avisar ──────────────────────────
update notifications set created_at = created_at - interval '1 hour';

\set place2 '''bbbbbbbb-0000-4000-8000-000000000004'''
set test.uid = :mateo;
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:place2, :mateo, 'Kokoro', 'friends', now(), now());

set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 2,
  'otra comida una hora despues si es una novedad distinta');

-- ── Un diario historico recien subido no despierta a nadie ───────────────────
-- `created_at` lo pone el movil al crear la fila, asi que iniciar sesion por
-- primera vez sube años de comidas de golpe.
update notifications set created_at = created_at - interval '1 hour';

\set old '''bbbbbbbb-0000-4000-8000-000000000005'''
set test.uid = :mateo;
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:old, :mateo, 'De hace dos años', 'friends', now() - interval '2 years', now());

set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 2,
  'subir un diario viejo no avisa de comidas de hace dos años');

-- ── Lo privado no avisa ──────────────────────────────────────────────────────
\set secret '''bbbbbbbb-0000-4000-8000-000000000006'''
set test.uid = :mateo;
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:secret, :mateo, 'Solo mio', 'private', now(), now());

set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 2,
  'lo que no se comparte no avisa');

-- ── 'default' se resuelve contra los ajustes, no contra la columna ───────────
-- Sin fila de ajustes, 'default' es privado, asi que esto no avisa todavia.
\set pending_dish '''bbbbbbbb-0000-4000-8000-000000000007'''
set test.uid = :mateo;
insert into dishes (uuid, user_id, restaurant_uuid, name, visibility, created_at, updated_at)
  values (:pending_dish, :mateo, :place, 'Gyoza', 'default', now(), now());

set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 2,
  'en default y sin ajustes, privado: no avisa');

-- Con el ajuste puesto, la misma columna significa lo contrario.
insert into visibility_defaults (user_id, restaurant, dish, visit)
  values (:mateo, 'private', 'friends', 'private');

\set shared_dish '''bbbbbbbb-0000-4000-8000-000000000008'''
set test.uid = :mateo;
insert into dishes (uuid, user_id, restaurant_uuid, name, visibility, created_at, updated_at)
  values (:shared_dish, :mateo, :place, 'Karaage', 'default', now(), now());

set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 3,
  'un plato en default con el ajuste en amigos si avisa');

-- ── Quien no es amigo no se entera de nada ───────────────────────────────────
set test.uid = :moni;
select expect_eq(unread_notifications(), 0, 'quien no es amigo no recibe publicaciones');

-- ── Dejar de ser amigos retira lo que apuntaba a su contenido ────────────────
set test.uid = :caro;
select remove_friend(:mateo);
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_published'), 0,
  'sin amistad no hay contenido que abrir: los avisos de publicacion se retiran');
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'friend_request'), 1,
  'pero la solicitud sigue: habla de la relacion, no de una comida');

-- Y el contador no se queda contando lo que la lista ya no enseña.
select expect_eq(
  unread_notifications(),
  (select count(*)::int from notifications_page() where read_at is null),
  'el punto y la lista cuentan lo mismo');

-- ── SEGURIDAD: los avisos son de quien son ───────────────────────────────────
set role authenticated;
set test.uid = :moni;
select expect_eq(
  (select count(*)::int from notifications), 0,
  'SEGURIDAD: quien no participa no ve ningun aviso');
set test.uid = :caro;
select expect_eq(
  (select count(*)::int from notifications where kind = 'friend_request'), 1,
  'y cada quien ve los suyos');
reset role;

\echo ''
\echo 'All social notification checks passed.'
