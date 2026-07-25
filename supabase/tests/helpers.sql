-- Assertions shared by the .test.sql files. Loaded by the runner after the
-- migrations, before each test file.

-- Raises on mismatch, so the script's exit code is the verdict and the runner
-- can print what passed.
create or replace function expect_eq(actual anyelement, expected anyelement, what text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % — expected %, got %', what, expected, actual;
  end if;
  raise notice 'ok: % (%)', what, actual;
end;
$$;

-- Grants the `authenticated` role what Supabase grants it in a real project,
-- so tests can `set role authenticated` and exercise RLS for real.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on feed to authenticated;
