-- El cursor del servidor (0017).
--
-- Run with `npm run db:test`.
--
-- Lo que se fija aquí: que `sync_seq` sea del servidor y no del cliente. Es lo
-- que hace que dos dispositivos con los relojes desfasados no pierdan filas.

\set ON_ERROR_STOP on
\pset pager off

\set mateo '''11111111-1111-1111-1111-111111111111'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{}');

\set uno '''cccccccc-0000-4000-8000-000000000001'''
\set dos '''cccccccc-0000-4000-8000-000000000002'''

set test.uid = :mateo;

-- Dos altas seguidas. La segunda tiene que quedar por delante de la primera.
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:uno, :mateo, 'Ichiran', 'private', now(), now());
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:dos, :mateo, 'Guadalupe', 'private', now(), now());

select expect_eq(
  (select (select sync_seq from restaurants where uuid = :dos)
        > (select sync_seq from restaurants where uuid = :uno)),
  true,
  'cada alta recibe un sync_seq mayor que la anterior');

-- ── Editar tiene que mover el sync_seq ───────────────────────────────────────
-- El default solo cubre el insert. Sin el trigger, una edición no cambiaría el
-- valor y el otro dispositivo no se enteraría nunca de ella.
create temp table seq_antes as
  select sync_seq from restaurants where uuid = :uno;

update restaurants set rating = 5, updated_at = now() where uuid = :uno;

select expect_eq(
  (select (select sync_seq from restaurants where uuid = :uno) > (select sync_seq from seq_antes)),
  true,
  'editar una fila la vuelve a poner al final de la cola');

-- ── Y el reloj del cliente no interviene ─────────────────────────────────────
-- Este es el bug entero: una fila escrita con una fecha *anterior* a la del
-- cursor del otro dispositivo tiene que seguir estando por delante en la cola
-- del servidor. Antes de 0017 se paginaba por `updated_at` y esta fila se
-- perdía en silencio.
\set tarde '''cccccccc-0000-4000-8000-000000000003'''
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at)
  values (:tarde, :mateo, 'Reloj atrasado', 'private', now(), '2020-01-01T00:00:00Z');

select expect_eq(
  (select (select sync_seq from restaurants where uuid = :tarde)
        > (select sync_seq from restaurants where uuid = :dos)),
  true,
  'una fila con updated_at viejo sigue siendo la última de la cola');

select expect_eq(
  (select updated_at < now() - interval '1 year' from restaurants where uuid = :tarde),
  true,
  'y conserva su updated_at, que es lo que decide qué versión gana');

-- ── Conteos para comparar con el móvil ───────────────────────────────────────
select expect_eq(
  (select rows::int from sync_counts() where table_name = 'restaurants'), 3,
  'sync_counts cuenta las filas vivas de la cuenta');

update restaurants set deleted = true, updated_at = now() where uuid = :tarde;
select expect_eq(
  (select rows::int from sync_counts() where table_name = 'restaurants'), 2,
  'y no cuenta las borradas: una lápida no es una entrada del diario');

\echo ''
\echo 'All sync cursor checks passed.'
