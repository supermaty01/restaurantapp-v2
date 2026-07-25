-- `dishes.price` admits decimals. Verify with `npm run db:test`.
--
-- The mirror declared it `integer`, copying the local schema — but SQLite does
-- not enforce column types: it stores 3.5 in an INTEGER column without
-- complaint, and Postgres then rejects the row on sync with
--
--     invalid input syntax for type integer: "3.5"
--
-- which failed the *whole* push, not just that dish.
--
-- Of the two ways to reconcile them, this is the one that does not lose data: a
-- price with decimals is ordinary, and rounding someone's records to make them
-- fit a column is not a migration, it is a correction nobody asked for.
alter table dishes
  alter column price type numeric(12, 2) using price::numeric;

comment on column dishes.price is
  'Decimal on purpose: SQLite stores whatever the app wrote, and prices have cents.';
