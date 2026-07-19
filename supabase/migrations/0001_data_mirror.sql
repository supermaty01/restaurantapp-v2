-- Data mirror for sync (docs/02, docs/03).
--
-- The server mirrors the app's personal data. Rows are keyed by the same uuid
-- the client generates locally; foreign keys reference other rows by uuid. The
-- integer local ids never leave the device.
--
-- Every table carries user_id (the owner), updated_at (client clock, for
-- last-write-wins) and deleted (soft-delete propagates as an update).
--
-- NOTE: not yet applied against a live project — verify with `supabase db reset`
-- (see docs/13). RLS is enabled on every table; a table without RLS would leak
-- every user's data.

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Personal data (mirror of the local SQLite schema) ────────────────────────
create table if not exists restaurants (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  latitude double precision,
  longitude double precision,
  comments text,
  rating integer,
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  deleted boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists tags (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  deleted boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists dishes (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_uuid uuid references restaurants (uuid) on delete cascade,
  name text not null,
  price integer,
  rating integer,
  comments text,
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  deleted boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists visits (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_uuid uuid references restaurants (uuid) on delete cascade,
  visited_at text not null,
  comments text,
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  deleted boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists people (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  linked_user_id uuid references auth.users (id) on delete set null,
  name text not null,
  deleted boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists images (
  uuid uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_uuid uuid references restaurants (uuid) on delete cascade,
  dish_uuid uuid references dishes (uuid) on delete cascade,
  visit_uuid uuid references visits (uuid) on delete cascade,
  remote_key text,
  description text,
  deleted boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- ── Junctions (identified by member uuids) ───────────────────────────────────
create table if not exists restaurant_tag (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_uuid uuid not null references restaurants (uuid) on delete cascade,
  tag_uuid uuid not null references tags (uuid) on delete cascade,
  primary key (restaurant_uuid, tag_uuid)
);

create table if not exists dish_tag (
  user_id uuid not null references auth.users (id) on delete cascade,
  dish_uuid uuid not null references dishes (uuid) on delete cascade,
  tag_uuid uuid not null references tags (uuid) on delete cascade,
  primary key (dish_uuid, tag_uuid)
);

create table if not exists dish_visit (
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_uuid uuid not null references visits (uuid) on delete cascade,
  dish_uuid uuid not null references dishes (uuid) on delete cascade,
  primary key (visit_uuid, dish_uuid)
);

create table if not exists visit_participant (
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_uuid uuid not null references visits (uuid) on delete cascade,
  person_uuid uuid not null references people (uuid) on delete cascade,
  tag_status text not null default 'local' check (tag_status in ('local', 'pending', 'accepted', 'rejected')),
  primary key (visit_uuid, person_uuid)
);

-- Pull queries filter by updated_at per table; index it.
create index if not exists restaurants_user_updated_idx on restaurants (user_id, updated_at);
create index if not exists dishes_user_updated_idx on dishes (user_id, updated_at);
create index if not exists visits_user_updated_idx on visits (user_id, updated_at);
create index if not exists tags_user_updated_idx on tags (user_id, updated_at);
create index if not exists people_user_updated_idx on people (user_id, updated_at);
create index if not exists images_user_updated_idx on images (user_id, updated_at);
