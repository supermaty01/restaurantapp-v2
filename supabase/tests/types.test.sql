-- The mirror has to accept what the device actually stores.
--
-- SQLite does not enforce column types: an INTEGER column happily holds 3.5.
-- Postgres does enforce them, so any column where the two disagree turns into a
-- sync that fails forever — and fails the whole push, not just the bad row.

\set ON_ERROR_STOP on
\pset pager off

\set someone '''77777777-7777-7777-7777-777777777777'''

insert into auth.users (id, email) values (:someone, 'tipos@example.com');

insert into restaurants (uuid, user_id, name, created_at, updated_at) values
  ('dddddddd-0000-0000-0000-000000000001', :someone, 'Sitio', now(), now());

-- ── Prices keep their decimals ───────────────────────────────────────────────
-- The value that broke a real sync.
insert into dishes (uuid, user_id, restaurant_uuid, name, price, created_at, updated_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', :someone, 'dddddddd-0000-0000-0000-000000000001',
   'Con decimales', 3.5, now(), now());

select expect_eq(
  (select price from dishes where uuid = 'eeeeeeee-0000-0000-0000-000000000001')::text,
  '3.50',
  'a decimal price survives the round trip');

insert into dishes (uuid, user_id, restaurant_uuid, name, price, created_at, updated_at) values
  ('eeeeeeee-0000-0000-0000-000000000002', :someone, 'dddddddd-0000-0000-0000-000000000001',
   'En pesos', 25000, now(), now());

select expect_eq(
  (select price from dishes where uuid = 'eeeeeeee-0000-0000-0000-000000000002')::int,
  25000,
  'a whole price is still whole');

-- ── Visibility only accepts what the app can produce ─────────────────────────
select expect_eq(
  (select visibility from dishes where uuid = 'eeeeeeee-0000-0000-0000-000000000001'),
  'private',
  'entries default to private');

do $$ begin
  update dishes set visibility = 'everyone' where uuid = 'eeeeeeee-0000-0000-0000-000000000001';
  raise exception 'FAIL: an unknown visibility was accepted';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'ok: an unknown visibility is rejected (%)', sqlerrm;
end $$;

-- ── A visit can have no date ─────────────────────────────────────────────────
-- Imported v1 diaries contain them, and rejecting them would leave those
-- visits stranded on the device with nothing saying why.
insert into visits (uuid, user_id, restaurant_uuid, visited_at, created_at, updated_at) values
  ('ffffffff-0000-0000-0000-000000000001', :someone, 'dddddddd-0000-0000-0000-000000000001',
   null, now(), now());

select expect_eq(
  (select count(*)::int from visits where uuid = 'ffffffff-0000-0000-0000-000000000001'),
  1,
  'a visit with no date is accepted');

\echo ''
\echo 'All type checks passed.'
