-- Abrir un plato o un sitio compartidos (0025). `npm run db:test`.
--
-- Lo que aqui puede aflojarse sin dar ningun error es el acceso: `dish_detail` y
-- `restaurant_detail` reciben un uuid cualquiera y son `security definer`, asi
-- que se ejecutan como el dueño de la base. Si la comprobacion se cae, entregan
-- el diario de cualquiera a cualquiera y la app se ve exactamente igual de bien.
--
-- Y hay una linea fina que hay que fijar, porque es la unica de esta migracion
-- que se puede argumentar en las dos direcciones: **un plato privado dentro de
-- una visita publica se ve en el detalle de esa visita y NO se puede abrir por
-- su cuenta**. Lo primero es 0011 (una comida que no dice que se comio no
-- comparte nada); lo segundo es que quien comparte decidio sobre esa comida.

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

-- Irene es amiga de Mateo. Caro no: solo estuvo en la cena. El desconocido, nada.
set test.uid = :mateo;
select send_friend_request(:irene);
set test.uid = :irene;
select respond_friend_request(:mateo, true);

\set sitio_amigos '''bbbbbbbb-0000-4000-8000-000000000001'''
\set sitio_privado '''bbbbbbbb-0000-4000-8000-000000000002'''
\set plato_amigos '''cccccccc-0000-4000-8000-000000000001'''
\set plato_privado '''cccccccc-0000-4000-8000-000000000002'''
\set visita '''dddddddd-0000-4000-8000-000000000001'''
\set persona '''eeeeeeee-0000-4000-8000-000000000001'''

insert into restaurants (uuid, user_id, name, rating, comments, visibility, created_at, updated_at) values
  (:sitio_amigos,  :mateo, 'Ichiran', 4, 'Buen caldo', 'friends', now(), now()),
  (:sitio_privado, :mateo, 'Secreto', 5, 'No lo cuento', 'private', now(), now());

insert into dishes (uuid, user_id, restaurant_uuid, name, price, currency, rating, visibility, created_at, updated_at) values
  (:plato_amigos,  :mateo, :sitio_amigos, 'Tonkotsu', 12.50, 'EUR', 5, 'friends', now(), now()),
  (:plato_privado, :mateo, :sitio_amigos, 'Gyoza',     4.00, 'EUR', 3, 'private', now(), now());

-- Una visita compartida con amigos, con los dos platos y Caro etiquetada.
insert into visits (uuid, user_id, restaurant_uuid, visited_at, visibility, created_at, updated_at)
  values (:visita, :mateo, :sitio_amigos, '2026-05-01', 'friends', now(), now());
insert into dish_visit (user_id, visit_uuid, dish_uuid) values
  (:mateo, :visita, :plato_amigos),
  (:mateo, :visita, :plato_privado);
insert into people (uuid, user_id, name, linked_user_id, username, created_at, updated_at)
  values (:persona, :mateo, 'Caro', :caro, 'caro', now(), now());
insert into visit_participant (user_id, visit_uuid, person_uuid, tag_status)
  values (:mateo, :visita, :persona, 'pending');

\echo '### un amigo abre lo compartido'

set test.uid = :irene;

select expect_eq(
  (dish_detail(:plato_amigos) ->> 'name'), 'Tonkotsu',
  'un amigo abre un plato compartido con amigos');

select expect_eq(
  (dish_detail(:plato_amigos) ->> 'currency'), 'EUR',
  'y el precio llega con su moneda, no como un numero suelto');

select expect_eq(
  (dish_detail(:plato_amigos) -> 'restaurant' ->> 'can_open'), 'true',
  'y dice que su restaurante tambien se puede abrir');

select expect_eq(
  (restaurant_detail(:sitio_amigos) ->> 'name'), 'Ichiran',
  'y abre el restaurante');

\echo '### lo privado no se abre, ni siquiera desde una visita que si se ve'

select expect_eq(
  (dish_detail(:plato_privado) is null), true,
  'SECURITY: un plato privado no se abre aunque su visita sea compartida');

select expect_eq(
  (restaurant_detail(:sitio_privado) is null), true,
  'SECURITY: un sitio privado tampoco');

-- Y lo que 0011 sigue garantizando: dentro de la visita se ve igual, porque una
-- comida que no dice que se comio no comparte nada.
select expect_eq(
  (select count(*)::int from json_array_elements(visit_detail(:visita) -> 'dishes') d
   where d.value ->> 'name' = 'Gyoza'), 1,
  'el plato privado sigue viajando dentro del detalle de la visita');

select expect_eq(
  (select d.value ->> 'can_open' from json_array_elements(visit_detail(:visita) -> 'dishes') d
   where d.value ->> 'name' = 'Gyoza'), 'false',
  'pero marcado como no abrible, para que la pantalla no ofrezca el toque');

select expect_eq(
  (select d.value ->> 'can_open' from json_array_elements(visit_detail(:visita) -> 'dishes') d
   where d.value ->> 'name' = 'Tonkotsu'), 'true',
  'y el compartido si');

\echo '### la etiqueta abre la puerta, igual que con la visita (0011/0015)'

set test.uid = :caro;

select expect_eq(
  (dish_detail(:plato_amigos) ->> 'name'), 'Tonkotsu',
  'quien estuvo en la cena abre el plato compartido sin ser amigo');

select expect_eq(
  (restaurant_detail(:sitio_amigos) ->> 'name'), 'Ichiran',
  'y el sitio donde ocurrio');

select expect_eq(
  (dish_detail(:plato_privado) is null), true,
  'SECURITY: pero no lo que su dueño no comparte');

\echo '### un desconocido no abre nada'

set test.uid = :stranger;

select expect_eq(
  (dish_detail(:plato_amigos) is null), true,
  'SECURITY: un desconocido no abre un plato de amigos');

select expect_eq(
  (restaurant_detail(:sitio_amigos) is null), true,
  'SECURITY: ni el restaurante');

select expect_eq(
  (visit_detail(:visita) is null), true,
  'SECURITY: ni la visita, que es de donde saldria el enlace');

\echo '### publico es publico'

set test.uid = :mateo;
update dishes set visibility = 'public' where uuid = :plato_amigos;

set test.uid = :stranger;
select expect_eq(
  (dish_detail(:plato_amigos) ->> 'name'), 'Tonkotsu',
  'un plato publico lo abre cualquiera con cuenta');

-- Pero el restaurante sigue siendo de amigos: que se pueda ver el plato no
-- arrastra al sitio. Es la regla de 0011 en la direccion que no se afloja.
select expect_eq(
  (dish_detail(:plato_amigos) -> 'restaurant' ->> 'can_open'), 'false',
  'SECURITY: y su restaurante de amigos sigue cerrado para un desconocido');

\echo '### el borrado se respeta'

set test.uid = :mateo;
update dishes set deleted = true where uuid = :plato_amigos;

select expect_eq(
  (dish_detail(:plato_amigos) is null), true,
  'un plato borrado no se abre ni para su dueño');

\echo '### los permisos de las funciones'

select expect_eq(
  has_function_privilege('authenticated', 'dish_detail(uuid)', 'execute'), true,
  'dish_detail la puede llamar quien ha iniciado sesion');

select expect_eq(
  has_function_privilege('anon', 'dish_detail(uuid)', 'execute'), false,
  'SECURITY: y no quien no la ha iniciado');

select expect_eq(
  has_function_privilege('anon', 'restaurant_detail(uuid)', 'execute'), false,
  'SECURITY: idem el restaurante');
