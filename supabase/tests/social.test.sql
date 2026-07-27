-- Behaviour tests for the social layer (0004–0006).
--
-- Run with `npm run db:test` from the repo root. The runner applies every
-- migration to a throwaway database on top of `auth-stub.sql`, so this exercises
-- the real SQL from zero without touching the developer's data.
--
-- Every check raises on failure, so the script's exit code is the verdict.

\set ON_ERROR_STOP on
\pset pager off

-- ── Fixtures ─────────────────────────────────────────────────────────────────
\set mateo   '''11111111-1111-1111-1111-111111111111'''
\set irene   '''22222222-2222-2222-2222-222222222222'''
\set stranger '''33333333-3333-3333-3333-333333333333'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:mateo, 'mateo@example.com', '{"full_name":"Mateo A"}'),
  (:irene, 'irene@example.com', '{}'),
  -- Same email local part as Mateo: the username must be de-duplicated.
  (:stranger, 'mateo@other.com', '{}');

-- ── Profiles are created on signup ───────────────────────────────────────────
-- Before 0005 nothing ever inserted a profile, so nobody could be found.
select expect_eq((select count(*)::int from profiles), 3, 'a profile per account');
select expect_eq(
  (select username from profiles where user_id = :mateo), 'mateo', 'username from email');
select expect_eq(
  (select username from profiles where user_id = :stranger), 'mateo1',
  'colliding username gets a suffix');
select expect_eq(
  (select display_name from profiles where user_id = :mateo), 'Mateo A',
  'display name from OAuth metadata');

-- ── Friend requests ──────────────────────────────────────────────────────────
set test.uid = :mateo;
select expect_eq((select count(*)::int from search_users('ire')), 1, 'search finds a user');
select expect_eq((select state from search_users('ire')), 'none', 'no relationship yet');
select expect_eq((select count(*)::int from search_users('i')), 0, 'one letter is too short');
-- Searching your own handle still finds *other* people whose name starts with
-- it (here: mateo1), but never you.
select expect_eq(
  (select count(*)::int from search_users('mateo') where username = 'mateo'), 0,
  'search never returns yourself');
select expect_eq(
  (select count(*)::int from search_users('mateo') where username = 'mateo1'), 1,
  'search still finds others sharing the prefix');

select expect_eq(send_friend_request(:irene), 'request_sent', 'request sent');
select expect_eq(friendship_state(:irene), 'request_sent', 'sender sees it as outgoing');
set test.uid = :irene;
select expect_eq(friendship_state(:mateo), 'request_received', 'recipient sees it as incoming');

-- Only the recipient may answer.
set test.uid = :mateo;
do $$ begin
  perform respond_friend_request('22222222-2222-2222-2222-222222222222', true);
  raise exception 'FAIL: the sender accepted their own request';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'ok: sender cannot accept their own request (%)', sqlerrm;
end $$;

set test.uid = :irene;
select expect_eq(respond_friend_request(:mateo, true), 'friends', 'recipient accepts');
select expect_eq((select state from list_friendships()), 'friends', 'listed as a friend');

-- ── Feed ─────────────────────────────────────────────────────────────────────
insert into restaurants (uuid, user_id, name, visibility, created_at, updated_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', :irene, 'Trattoria Bella', 'friends', now(), now());
insert into visits
  (uuid, user_id, restaurant_uuid, visited_at, comments, visibility, created_at, updated_at)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', :irene, 'aaaaaaaa-0000-0000-0000-000000000001',
   '2026-07-01', 'Pasta night', 'friends', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', :irene, 'aaaaaaaa-0000-0000-0000-000000000001',
   '2026-07-02', 'Secreto', 'private', now(), now());

set test.uid = :mateo;
-- One card, not two. Irene shared the restaurant *and* a visit to it, and since
-- 0012 the visit stands for both: the restaurant is where the meal happened,
-- not a separate thing that also happened.
select expect_eq((select count(*)::int from feed_page()), 1, 'friend sees the shared meal');
select expect_eq(
  (select kind from feed_page()), 'visit', 'and it is the visit that represents it');
select expect_eq(
  (select count(*)::int from feed_page() where comments = 'Secreto'), 0,
  'private entries never reach the feed');
select expect_eq(
  (select place from feed_page() where kind = 'visit'), 'Trattoria Bella',
  'feed rows carry the place name');
select expect_eq(
  (select username from feed_page() where kind = 'visit'), 'irene',
  'feed rows carry the author');

set test.uid = :stranger;
select expect_eq((select count(*)::int from feed_page()), 0, 'a stranger sees nothing');

-- ── The feed view must obey RLS ──────────────────────────────────────────────
-- Regression test for the 0004 leak: a Postgres view runs with its definer's
-- rights unless it opts into `security_invoker`, so this view used to hand every
-- user's friends/public rows to anyone who selected from it. Verified to catch
-- the bug: reverting 0005's view definition makes this return 2.
set test.uid = :stranger;
set role authenticated;
select expect_eq((select count(*)::int from feed), 0, 'SECURITY: view leaks nothing to a stranger');
reset role;

set test.uid = :mateo;
set role authenticated;
select expect_eq((select count(*)::int from feed), 2, 'view still serves an actual friend');
reset role;

-- ── Unfriending ──────────────────────────────────────────────────────────────
set test.uid = :mateo;
select expect_eq(remove_friend(:irene), 'none', 'friendship removed');
select expect_eq((select count(*)::int from feed_page()), 0, 'feed empties after unfriending');

-- Two people adding each other is mutual consent, not two pending requests.
select expect_eq(send_friend_request(:irene), 'request_sent', 'new request');
set test.uid = :irene;
select expect_eq(send_friend_request(:mateo), 'friends', 'crossing requests become a friendship');

\echo ''
\echo 'All social checks passed.'
