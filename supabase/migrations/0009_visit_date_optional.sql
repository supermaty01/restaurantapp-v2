-- `visits.visited_at` may be absent. Verify with `npm run db:test`.
--
-- The mirror declared it `not null`, copying the local schema — but importing a
-- v1 backup replaces the SQLite file wholesale, so the rows that end up on the
-- device are whatever v1 wrote, and drizzle's `notNull()` is a declaration
-- about new writes, not a check on data that is already there. Real backups
-- contain visits with no date.
--
-- Refusing them means those visits never reach the cloud and nothing says so:
-- a silent hole in someone's diary is worse than a row with a missing field.
-- The app already copes — the month timeline groups them under "Sin fecha".
alter table visits
  alter column visited_at drop not null;

comment on column visits.visited_at is
  'Nullable: imported v1 diaries contain visits with no recorded date.';
