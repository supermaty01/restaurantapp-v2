-- Server-only tables written by the Worker (docs/05): share links and the AI
-- usage ledger. Verify with `supabase db reset` (docs/13).

create table if not exists share_links (
  id text primary key, -- short nanoid
  owner_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('restaurant', 'dish', 'visit')),
  content jsonb not null, -- the shareable payload the app imports
  preview jsonb not null, -- title/subtitle/image/rating for the web unfurl
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false
);

create index if not exists share_links_owner_idx on share_links (owner_id);

-- The Worker uses the service role (bypasses RLS) for public reads; direct
-- client access is owner-only.
alter table share_links enable row level security;
create policy share_links_owner on share_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Per-user AI budget (docs/07). Reset per period; the Worker hard-stops when
-- tokens_used exceeds the budget.
create table if not exists ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null, -- e.g. '2026-07' (monthly)
  tokens_used integer not null default 0,
  primary key (user_id, period)
);

alter table ai_usage enable row level security;
create policy ai_usage_owner on ai_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
