-- Avisar de un me gusta (0027). `npm run db:test`.
--
-- Lo que se fija aquí, en orden de lo caro que sale equivocarse:
--
-- 1. Que **no se pueda usar como timbre**. Quitar y volver a dar me gusta es un
--    gesto que cuesta dos toques desde el móvil de otra persona; si cada uno
--    emitiera un aviso, cualquiera puede hacer sonar el tuyo cuarenta veces.
-- 2. Que el aviso sepa **a qué le dieron**, también cuando no es una visita.
--    Es la mitad de la migración: la tabla solo tenía `visit_uuid`.
-- 3. Que un me gusta a algo borrado **deje de verse**, y que el contador y la
--    lista digan lo mismo — el fallo que la 0019 ya arregló una vez para las
--    etiquetas (un punto encendido sobre una lista vacía).

\set ON_ERROR_STOP on
\pset pager off

\set mateo '''11111111-1111-1111-1111-111111111111'''
\set irene '''22222222-2222-2222-2222-222222222222'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}'),
  (:irene, 'irene@example.com', '{}');

set test.uid = :mateo;
select send_friend_request(:irene);
set test.uid = :irene;
select respond_friend_request(:mateo, true);

\set sitio  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set plato  '''cccccccc-0000-4000-8000-000000000001'''
\set visita '''dddddddd-0000-4000-8000-000000000001'''

insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:sitio, :mateo, 'Ichiran', 'friends', now(), now());
insert into dishes (uuid, user_id, restaurant_uuid, name, visibility, created_at, updated_at)
  values (:plato, :mateo, :sitio, 'Tonkotsu', 'friends', now(), now());
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:visita, :mateo, :sitio, '2026-05-01', 'friends', now(), now());

\echo '### dar me gusta avisa a quien lo escribio'

set test.uid = :irene;
select toggle_like(:plato, 'dish');

set test.uid = :mateo;

select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'entry_liked'), 1,
  'a Mateo le llega un aviso de me gusta');

select expect_eq(
  (select title from notifications_page() where kind = 'entry_liked'), 'Tonkotsu',
  'y dice a que le dieron, no solo que le dieron a algo');

select expect_eq(
  (select entity_kind from notifications_page() where kind = 'entry_liked'), 'dish',
  'y de que clase es, para saber que pantalla abrir');

select expect_eq(
  (select entity_uuid from notifications_page() where kind = 'entry_liked'), :plato::uuid,
  'y cual, que es lo que abre el aviso al tocarlo');

-- Contra la lista y no contra un numero fijo: el alta de amistad de arriba ya
-- deja su propio aviso sin leer, asi que un 1 a pelo estaria contando mal a
-- proposito. Lo que importa es que el contador y la lista no se separen.
select expect_eq(
  unread_notifications(),
  (select count(*)::int from notifications_page() where read_at is null),
  'el punto cuenta lo mismo que hay en la lista');

select expect_eq(
  (select read_at is null from notifications_page() where kind = 'entry_liked'), true,
  'y el aviso del me gusta nace sin leer');

\echo '### quitar y volver a dar NO vuelve a avisar'

set test.uid = :irene;
select toggle_like(:plato, 'dish');  -- lo quita
select toggle_like(:plato, 'dish');  -- lo vuelve a dar
select toggle_like(:plato, 'dish');
select toggle_like(:plato, 'dish');

set test.uid = :mateo;
select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'entry_liked'), 1,
  'SECURITY: cuatro toques mas y sigue habiendo un solo aviso');

\echo '### las tres clases de entrada, cada una con su nombre'

set test.uid = :irene;
select toggle_like(:visita, 'visit');
select toggle_like(:sitio, 'restaurant');

set test.uid = :mateo;

select expect_eq(
  (select title from notifications_page() where entity_kind = 'visit'), 'Ichiran',
  'una visita se titula por su restaurante');

select expect_eq(
  (select title from notifications_page() where entity_kind = 'restaurant'), 'Ichiran',
  'y un sitio, por su nombre');

select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'entry_liked'), 3,
  'tres entradas, tres avisos');

\echo '### lo propio no avisa'

set test.uid = :mateo;
select toggle_like(:plato, 'dish');

select expect_eq(
  (select count(*)::int from notifications_page() where kind = 'entry_liked'), 3,
  'darle me gusta a lo tuyo no te avisa a ti mismo');

\echo '### un me gusta a algo borrado deja de verse'

update dishes set deleted = true where uuid = :plato;

select expect_eq(
  (select count(*)::int from notifications_page() where entity_kind = 'dish'), 0,
  'el aviso del plato borrado sale de la lista');

-- El fallo que la 0019 arreglo para las etiquetas: el contador miraba una regla
-- y la lista otra, asi que quedaba un punto encendido sobre una lista vacia.
select expect_eq(
  unread_notifications(),
  (select count(*)::int from notifications_page() where read_at is null),
  'y el contador dice lo mismo que la lista');

\echo '### marcar como leido sigue funcionando con la clase nueva'

select mark_notifications_read();
select expect_eq(unread_notifications(), 0, 'el punto se apaga');
