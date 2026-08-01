-- Las secciones del perfil de otra persona (0022). `npm run db:test`.
--
-- Lo que aquí puede salir mal en silencio es lo mismo de siempre en este
-- proyecto: una función nueva que reparte los datos y **afloja el filtro de
-- acceso por el camino**. `user_entries_page` y `user_entry_counts` reciben un
-- `target` cualquiera, así que hay que comprobar que un desconocido sigue viendo
-- solo lo público — y que el recuento que decide qué pestañas se pintan cuenta
-- lo mismo que la lista, o la app enseñaría una pestaña con un número que al
-- abrirla está vacía.

\set ON_ERROR_STOP on
\pset pager off

\set mateo  '''11111111-1111-1111-1111-111111111111'''
\set irene  '''22222222-2222-2222-2222-222222222222'''
\set carla  '''33333333-3333-3333-3333-333333333333'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}'),
  (:irene, 'irene@example.com', '{}'),
  (:carla, 'carla@example.com', '{}');

-- Mateo e Irene son amigos. Carla no conoce a nadie.
set test.uid = :mateo;
select send_friend_request(:irene);
set test.uid = :irene;
select respond_friend_request(:mateo, true);

\set publico  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set deamigos '''bbbbbbbb-0000-4000-8000-000000000002'''
\set privado  '''bbbbbbbb-0000-4000-8000-000000000003'''
\set plato_a  '''cccccccc-0000-4000-8000-000000000001'''
\set plato_b  '''cccccccc-0000-4000-8000-000000000002'''
\set visita   '''dddddddd-0000-4000-8000-000000000001'''

-- Tres sitios de Mateo, uno por nivel. Nombres elegidos para que la ordenación
-- alfabética no coincida con la de creación ni con la de nota.
insert into restaurants (uuid, user_id, name, rating, visibility, created_at, updated_at) values
  (:publico,  :mateo, 'Zorrilla',  3, 'public',  '2026-01-01', now()),
  (:deamigos, :mateo, 'Ávila',     5, 'friends', '2026-02-01', now()),
  (:privado,  :mateo, 'Mercado',   4, 'private', '2026-03-01', now());

-- Dos platos sueltos, públicos, con notas distintas.
insert into dishes (uuid, user_id, restaurant_uuid, name, rating, visibility, created_at, updated_at) values
  (:plato_a, :mateo, :publico, 'Arroz',   2, 'public', '2026-01-02', now()),
  (:plato_b, :mateo, :publico, 'Bocata',  5, 'public', '2026-01-03', now());

\echo '### un desconocido solo ve lo publico'

set test.uid = :carla;

select expect_eq(
  (select total::int from user_entry_counts(:mateo) where kind = 'restaurant'), 1,
  'SECURITY: para un desconocido, un solo sitio — el publico');

select expect_eq(
  (select count(*)::int from user_entries_page(:mateo, 'restaurant')), 1,
  'y la lista dice lo mismo que el recuento');

select expect_eq(
  (select title from user_entries_page(:mateo, 'restaurant')), 'Zorrilla',
  'y es el publico, no el de amigos');

select expect_eq(
  (select total::int from user_entry_counts(:mateo) where kind = 'visit'), 0,
  'sin visitas compartidas, el recuento es cero y no una fila que falta');

\echo '### un amigo ve ademas lo de amigos, y nunca lo privado'

set test.uid = :irene;

select expect_eq(
  (select total::int from user_entry_counts(:mateo) where kind = 'restaurant'), 2,
  'un amigo ve el publico y el de amigos');

select expect_eq(
  (select count(*)::int from user_entries_page(:mateo, 'restaurant')
   where entity_uuid = :privado::uuid), 0,
  'SECURITY: el privado no aparece ni para un amigo');

\echo '### uno mismo se ve entero'

set test.uid = :mateo;

select expect_eq(
  (select total::int from user_entry_counts(:mateo) where kind = 'restaurant'), 3,
  'el dueno ve los tres');

\echo '### el orden es el que se pide'

set test.uid = :mateo;

select expect_eq(
  (select title from user_entries_page(:mateo, 'restaurant', 'name', false, null, 0, 1)),
  'Ávila',
  'por nombre ascendente, la tilde va donde la busca quien lee y no detras de la z');

select expect_eq(
  (select title from user_entries_page(:mateo, 'restaurant', 'rating', true, null, 0, 1)),
  'Ávila',
  'por nota descendente, primero el de cinco');

select expect_eq(
  (select title from user_entries_page(:mateo, 'restaurant', 'rating', false, null, 0, 1)),
  'Zorrilla',
  'y ascendente, primero el de tres');

select expect_eq(
  (select title from user_entries_page(:mateo, 'restaurant', 'date', true, null, 0, 1)),
  'Mercado',
  'por fecha descendente, el mas reciente');

\echo '### el filtro de nota'

select expect_eq(
  (select count(*)::int from user_entries_page(:mateo, 'dish', 'date', true, 4)), 1,
  'con minimo 4 solo queda el bocata');

-- Una visita compartida, para comprobar que el filtro de nota no se las come.
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:visita, :mateo, :publico, '2026-04-01', 'public', now(), now());

select expect_eq(
  (select count(*)::int from user_entries_page(:mateo, 'visit', 'date', true, 5)), 1,
  'una visita no tiene nota propia, asi que el minimo no la esconde');

\echo '### un sitio del que ya se cuenta una comida sale de la pestana de lugares'

-- Regla heredada del feed (0012) y no un descuido: la visita ya nombra el sitio,
-- y repetirlo como entrada suelta lo contaria dos veces. Se comprueba porque es
-- lo que hace que el numero de la pestana no sea «cuantos sitios tiene».
select expect_eq(
  (select count(*)::int from user_entries_page(:mateo, 'restaurant')
   where entity_uuid = :publico::uuid), 0,
  'Zorrilla desaparece de lugares en cuanto hay una visita suya compartida');

\echo '### la paginacion no repite ni se salta filas'

-- Dos sitios con la misma nota: sin desempate estable, el que cae en el borde
-- de la pagina puede salir dos veces o ninguna.
\set empate1 '''bbbbbbbb-0000-4000-8000-000000000004'''
\set empate2 '''bbbbbbbb-0000-4000-8000-000000000005'''
insert into restaurants (uuid, user_id, name, rating, visibility, created_at, updated_at) values
  (:empate1, :mateo, 'Empate uno', 3, 'public', '2026-05-01', now()),
  (:empate2, :mateo, 'Empate dos', 3, 'public', '2026-05-01', now());

-- Cuatro en la seccion: los tres iniciales menos Zorrilla, que se fue con su
-- visita, mas los dos del empate.
select expect_eq(
  (select total::int from user_entry_counts(:mateo) where kind = 'restaurant'), 4,
  'el recuento sigue cuadrando con lo que hay');

select expect_eq(
  (select count(distinct entity_uuid)::int from (
     select entity_uuid from user_entries_page(:mateo, 'restaurant', 'rating', true, null, 0, 3)
     union all
     select entity_uuid from user_entries_page(:mateo, 'restaurant', 'rating', true, null, 3, 3)
   ) as todas), 4,
  'dos paginas traen las cuatro, sin repetir ninguna pese al empate a tres');

\echo '### la base no es publica'

-- La que no pagina se queda dentro: quien llama entra por las dos de arriba.
select expect_eq(
  has_function_privilege('authenticated', 'user_entries_all(uuid)', 'execute'), false,
  'SECURITY: authenticated no puede llamar a user_entries_all directamente');

select expect_eq(
  has_function_privilege('authenticated', 'user_entries_page(uuid, text, text, boolean, int, int, int)', 'execute'),
  true,
  'y si a la que pagina');
