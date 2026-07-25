-- Behaviour tests for the profile page RPCs (0007).
--
-- The point of these is the visibility ladder: the same profile has to look
-- different to yourself, to a friend and to a stranger, and it is easy to write
-- a query that quietly shows everyone everything.

\set ON_ERROR_STOP on
\pset pager off

\set ana    '''44444444-4444-4444-4444-444444444444'''
\set beto   '''55555555-5555-5555-5555-555555555555'''
\set carla  '''66666666-6666-6666-6666-666666666666'''

insert into auth.users (id, email) values
  (:ana, 'ana@example.com'),
  (:beto, 'beto@example.com'),
  (:carla, 'carla@example.com');

update profiles set bio = 'Como mucho arroz' where user_id = :ana;

-- Ana and Beto are friends; Carla is a stranger to both.
set test.uid = :ana;
select send_friend_request(:beto);
set test.uid = :beto;
select respond_friend_request(:ana, true);

-- Ana logs one entry at each visibility level.
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at) values
  ('cccccccc-0000-0000-0000-000000000001', :ana, 'Solo mío',  'private', now(), now()),
  ('cccccccc-0000-0000-0000-000000000002', :ana, 'Para amigos', 'friends', now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', :ana, 'Para todos',  'public',  now(), now());

\echo '### how the same profile looks to three people'

set test.uid = :ana;
select expect_eq((select state from user_profile(:ana)), 'self', 'you see yourself as self');
select expect_eq((select count(*)::int from user_entries(:ana)), 3, 'you see all your own entries');
select expect_eq(
  (select bio from user_profile(:ana)), 'Como mucho arroz', 'you see your own bio');

set test.uid = :beto;
select expect_eq((select state from user_profile(:ana)), 'friends', 'a friend is marked as such');
select expect_eq((select count(*)::int from user_entries(:ana)), 2, 'a friend sees friends+public');
select expect_eq(
  (select count(*)::int from user_entries(:ana) where title = 'Solo mío'), 0,
  'a friend never sees private entries');
select expect_eq((select bio from user_profile(:ana)), 'Como mucho arroz', 'a friend sees the bio');

set test.uid = :carla;
select expect_eq((select state from user_profile(:ana)), 'none', 'a stranger has no relationship');
select expect_eq((select count(*)::int from user_entries(:ana)), 1, 'a stranger sees only public');
select expect_eq(
  (select title from user_entries(:ana)), 'Para todos', 'and it is the public one');
select expect_eq((select bio from user_profile(:ana)), null, 'a stranger does not get the bio');

\echo '### counts'
set test.uid = :beto;
select expect_eq((select friend_count from user_profile(:ana))::int, 1, 'friend count');

-- A profile that does not exist must be empty, not an error.
select expect_eq(
  (select count(*)::int from user_profile('00000000-0000-0000-0000-000000000000')), 0,
  'unknown user yields no row');

\echo ''
\echo 'All profile checks passed.'
