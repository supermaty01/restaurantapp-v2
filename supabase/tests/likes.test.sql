-- Me gusta (0026). `npm run db:test`.
--
-- Lo primero que la app escribe **sobre una entrada ajena**, asi que lo que hay
-- que fijar es que no se pueda escribir sobre una que no se puede leer: sin esa
-- comprobacion, un cliente que se invente un uuid hace subir el contador de una
-- entrada privada, y un contador que sube confirma que la entrada existe aunque
-- no enseñe lo que dice.
--
-- Y lo otro: que la tabla no se pueda leer entera. «Quien ha dado me gusta a
-- que» es la lista de lo que mira cada persona, y una policy `for select` sobre
-- la tabla la abriria del todo (AGENTS §3.4).

\set ON_ERROR_STOP on
\pset pager off

\set mateo    '''11111111-1111-1111-1111-111111111111'''
\set irene    '''22222222-2222-2222-2222-222222222222'''
\set stranger '''44444444-4444-4444-4444-444444444444'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}'),
  (:irene, 'irene@example.com', '{}'),
  (:stranger, 'nadie@example.com', '{}');

set test.uid = :mateo;
select send_friend_request(:irene);
set test.uid = :irene;
select respond_friend_request(:mateo, true);

\set sitio   '''bbbbbbbb-0000-4000-8000-000000000001'''
\set secreto '''bbbbbbbb-0000-4000-8000-000000000002'''
\set visita  '''dddddddd-0000-4000-8000-000000000001'''

insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at) values
  (:sitio,   :mateo, 'Ichiran', 'friends', now(), now()),
  (:secreto, :mateo, 'Secreto', 'private', now(), now());

insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:visita, :mateo, :sitio, '2026-05-01', 'friends', now(), now());

\echo '### dar y quitar es el mismo verbo'

set test.uid = :irene;

select expect_eq(
  (toggle_like(:visita, 'visit') ->> 'liked'), 'true',
  'el primer toque da me gusta');

select expect_eq(
  (toggle_like(:visita, 'visit') ->> 'liked'), 'false',
  'y el segundo lo quita');

select expect_eq(
  (toggle_like(:visita, 'visit') ->> 'total'), '1',
  'el total vuelve a uno al darlo otra vez, y viene resuelto en la respuesta');

\echo '### el recuento viaja con lo que se pinta'

select expect_eq(
  (select like_count::int from feed_page() where entity_uuid = :visita::uuid), 1,
  'el feed trae el recuento');

select expect_eq(
  (select liked_by_me from feed_page() where entity_uuid = :visita::uuid), true,
  'y si lo has dado tu');

select expect_eq(
  (select like_count::int from user_entries_page(:mateo, 'visit') where entity_uuid = :visita::uuid), 1,
  'la seccion del perfil, tambien');

select expect_eq(
  ((visit_detail(:visita) ->> 'like_count')), '1',
  'y el detalle de la visita');

\echo '### el autor lo ve en su propio perfil sin haberlo dado el'

set test.uid = :mateo;

select expect_eq(
  (select like_count::int from user_entries_page(:mateo, 'visit') where entity_uuid = :visita::uuid), 1,
  'el recuento es de todos, no solo de quien mira');

select expect_eq(
  (select liked_by_me from user_entries_page(:mateo, 'visit') where entity_uuid = :visita::uuid), false,
  'pero «lo he dado yo» sigue siendo de quien mira');

\echo '### no se puede dar me gusta a lo que no se puede leer'

set test.uid = :stranger;

do $$
begin
  perform toggle_like('dddddddd-0000-4000-8000-000000000001'::uuid, 'visit');
  raise exception 'FALLO: un desconocido pudo dar me gusta a una visita de amigos';
exception when insufficient_privilege then
  raise notice 'ok: SECURITY: un desconocido no puede dar me gusta a una visita de amigos';
end;
$$;

set test.uid = :irene;

do $$
begin
  perform toggle_like('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'restaurant');
  raise exception 'FALLO: se pudo dar me gusta a un sitio privado';
exception when insufficient_privilege then
  raise notice 'ok: SECURITY: ni una amiga puede dar me gusta a lo que no se comparte';
end;
$$;

-- Y un uuid que no es de nada: el mismo camino, para que la respuesta no
-- distinga «no existe» de «no es para ti».
do $$
begin
  perform toggle_like('99999999-0000-4000-8000-000000000000'::uuid, 'visit');
  raise exception 'FALLO: se pudo dar me gusta a un uuid inventado';
exception when insufficient_privilege then
  raise notice 'ok: SECURITY: un uuid inventado se rechaza igual que uno ajeno';
end;
$$;

select expect_eq(
  (select count(*)::int from entry_likes where entity_uuid = :secreto::uuid), 0,
  'SECURITY: y no quedo ninguna fila de los intentos');

\echo '### la tabla solo enseña lo tuyo'

-- `set role authenticated` de verdad: el superusuario se salta RLS, asi que sin
-- esto la comprobacion pasaria siempre y no estaria comprobando nada.
--
-- Irene dio el me gusta; Mateo, no. Mateo no ve esa fila aunque sea de una
-- visita suya: el recuento sale de las funciones, no de la tabla.
set test.uid = :mateo;
set role authenticated;
select expect_eq(
  (select count(*)::int from entry_likes), 0,
  'SECURITY: la tabla no enseña los me gusta de otra persona');
reset role;

set test.uid = :irene;
set role authenticated;
select expect_eq(
  (select count(*)::int from entry_likes), 1,
  'y si los tuyos, que es lo que hace falta para quitarlos');

-- Y no se puede escribir uno a mano en nombre de otra persona, que es la otra
-- puerta: `toggle_like` comprueba el acceso, pero un `insert` directo por
-- PostgREST se saltaria la funcion entera si la policy dejara.
do $$
begin
  insert into entry_likes (user_id, entity_uuid, kind)
    values ('11111111-1111-1111-1111-111111111111'::uuid,
            'dddddddd-0000-4000-8000-000000000001'::uuid, 'visit');
  raise exception 'FALLO: se pudo escribir un me gusta en nombre de otra persona';
exception when insufficient_privilege then
  raise notice 'ok: SECURITY: la policy rechaza un me gusta a nombre de otra persona';
end;
$$;
reset role;

\echo '### los permisos de la funcion'

select expect_eq(
  has_function_privilege('authenticated', 'toggle_like(uuid, text)', 'execute'), true,
  'toggle_like la puede llamar quien ha iniciado sesion');

select expect_eq(
  has_function_privilege('anon', 'toggle_like(uuid, text)', 'execute'), false,
  'SECURITY: y no quien no la ha iniciado');
