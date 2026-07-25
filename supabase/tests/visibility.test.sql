-- `default` sigue al ajuste, no lo copia (0014). `npm run db:test`.
--
-- El fallo que corrige: el usuario tenía "mis amigos ven mis visitas" y sus
-- amigos no veían nada, porque cada fila guardaba una copia del ajuste que
-- había en el momento de crearla -- y las importadas de la v1 ni eso, se
-- quedaron en 'private' porque en la v1 el campo no existía.

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

\set place '''bbbbbbbb-0000-4000-8000-000000000001'''
\set old   '''bbbbbbbb-0000-4000-8000-000000000002'''
\set pinned '''bbbbbbbb-0000-4000-8000-000000000003'''

-- Una visita "de la v1": nunca eligió visibilidad.
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:place, :mateo, 'Crêperie', 'default', now(), now());
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:old, :mateo, :place, '2024-06-26', 'default', now(), now());
-- Y una que sí: privada a mano.
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:pinned, :mateo, :place, '2024-06-27', 'private', now(), now());

-- ── Sin ajustes, privado ─────────────────────────────────────────────────────
set test.uid = :irene;
select expect_eq((select count(*)::int from feed_page()), 0, 'sin ajustes, nada se comparte');

-- ── Cambiar el ajuste mueve lo que está en default ───────────────────────────
set test.uid = :mateo;
select set_visibility_defaults('friends', 'friends', 'friends');

set test.uid = :irene;
select expect_eq(
  (select count(*)::int from feed_page()), 1,
  'cambiar el ajuste hace visible lo que estaba en default');
select expect_eq(
  (select entity_uuid from feed_page()), :old::uuid,
  'y es la visita que nunca eligió, no la que se marcó privada');
select expect_eq(can_read_visit(:old), true, 'un amigo puede leerla');
select expect_eq(can_read_visit(:pinned), false, 'la elegida a mano no se mueve');

-- ── Y volver atrás también lo mueve ──────────────────────────────────────────
set test.uid = :mateo;
select set_visibility_defaults('private', 'private', 'private');
set test.uid = :irene;
select expect_eq(
  (select count(*)::int from feed_page()), 0,
  'volver el ajuste a privado lo retira otra vez');

-- ── Una elección explícita se impone al ajuste ───────────────────────────────
set test.uid = :mateo;
update visits set visibility = 'friends' where uuid = :pinned;
set test.uid = :irene;
select expect_eq(
  (select count(*)::int from feed_page()), 1,
  'una entrada marcada a mano se comparte aunque el ajuste sea privado');
select expect_eq(
  (select entity_uuid from feed_page()), :pinned::uuid, 'y es exactamente esa');

-- ── Cada tipo tiene su propio ajuste ─────────────────────────────────────────
set test.uid = :mateo;
select set_visibility_defaults('friends', 'private', 'private');
select expect_eq(
  effective_visibility('default', :mateo, 'restaurant'), 'friends', 'lugares: amigos');
select expect_eq(
  effective_visibility('default', :mateo, 'dish'), 'private', 'platos: privado');
select expect_eq(
  effective_visibility('default', :mateo, 'visit'), 'private', 'visitas: privado');

-- ── Los ajustes de otro no dicen nada de su contenido ────────────────────────
set test.uid = :irene;
set role authenticated;
select expect_eq(
  (select restaurant from visibility_defaults where user_id = :mateo), 'friends',
  'los ajustes ajenos se leen: hacen falta para resolver su contenido');
select expect_eq(
  (select count(*)::int from visits where uuid = :old), 0,
  'SECURITY: pero eso no abre sus filas en default privado');
reset role;

\echo ''
\echo 'All visibility checks passed.'
