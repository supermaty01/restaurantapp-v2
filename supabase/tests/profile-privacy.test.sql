-- Que la bio no se pueda leer por la puerta de al lado (0020).
--
-- `profile.test.sql` ya comprueba que `user_profile()` esconde la biografía a un
-- desconocido. Lo que faltaba comprobar es que no haya otra forma de pedirla —
-- que es lo que había: la política de `profiles` era `for select using
-- (auth.role() = 'authenticated')`, a nivel de tabla y sin columnas, así que
-- `select bio from profiles` la devolvía igual. La comprobación cuidadosa de la
-- RPC se esquivaba cambiando de endpoint.

\set ON_ERROR_STOP on
\pset pager off

\set ana    '''44444444-4444-4444-4444-444444444444'''
\set carla  '''66666666-6666-6666-6666-666666666666'''

insert into auth.users (id, email) values
  (:ana, 'ana@example.com'),
  (:carla, 'carla@example.com');

update profiles set bio = 'Como mucho arroz' where user_id = :ana;

\echo '### la bio, por la puerta de atras'

set test.uid = :carla;
set role authenticated;

select expect_eq(
  (select count(*)::int from profiles where user_id = :ana), 0,
  'SECURITY: un desconocido ya no lee la fila de perfil de otra persona');

select expect_eq(
  (select bio from user_profile(:ana)), null,
  'y la RPC sigue sin darle la bio');

select expect_eq(
  (select username from public_profiles where user_id = :ana), 'ana',
  'lo publico sigue siendo publico: se puede encontrar a la gente');

reset role;

\echo '### el propio perfil se sigue leyendo entero'

set test.uid = :ana;
set role authenticated;

select expect_eq(
  (select bio from profiles where user_id = :ana), 'Como mucho arroz',
  'uno lee su propia bio de la tabla');

select expect_eq(
  (select bio from user_profile(:ana)), 'Como mucho arroz',
  'y por la RPC tambien');

reset role;

\echo '### un aviso solo se puede marcar como leido'

\set beto '''55555555-5555-5555-5555-555555555555'''
insert into auth.users (id, email) values (:beto, 'beto@example.com');

-- Con `pushed_at` ya puesto, como lo deja el Worker despues de repartirlo. Sin
-- eso, ponerlo a null no cambia nada y el trigger deja pasar el update con toda
-- la razon: no habia nada que reescribir.
insert into notifications (user_id, kind, actor_id, created_at, pushed_at)
  values (:ana, 'friend_request', :beto, now(), now());

set test.uid = :ana;
set role authenticated;

update notifications set read_at = now() where user_id = :ana;
select expect_eq(
  (select count(*)::int from notifications where user_id = :ana and read_at is not null), 1,
  'marcarlo como leido sigue funcionando');

-- Lo que 0016 decia que no se podia hacer y si se podia. `pushed_at` a null
-- hace que el Worker lo vuelva a repartir.
do $$
begin
  update notifications set pushed_at = null where user_id = current_setting('test.uid')::uuid;
  raise exception 'FAIL: se pudo reescribir pushed_at desde el cliente';
exception
  when others then
    if position('solo se puede cambiar read_at' in sqlerrm) = 0 then
      raise;
    end if;
    raise notice 'ok: SECURITY: reescribir pushed_at se rechaza (%)', sqlerrm;
end;
$$;

do $$
begin
  update notifications set kind = 'tagged_in_visit' where user_id = current_setting('test.uid')::uuid;
  raise exception 'FAIL: se pudo reescribir kind desde el cliente';
exception
  when others then
    if position('solo se puede cambiar read_at' in sqlerrm) = 0 then
      raise;
    end if;
    raise notice 'ok: SECURITY: reescribir kind se rechaza (%)', sqlerrm;
end;
$$;

reset role;

\echo ''
\echo 'All profile privacy checks passed.'
