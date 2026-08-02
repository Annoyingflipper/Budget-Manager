-- v1.9 chunk 2: optional per-expense currency with a per-expense rate override.
--
-- Both columns are nullable with no default, so every existing row is untouched
-- and reads as "no currency set", which means "in the user's base currency".
-- Same additive approach as line_items.paid_on in v1.8 — no backfill needed.
--
-- rate_units_per_usd overrides the daily exchange_rates table for this one
-- expense: for when the money was actually changed at a rate other than the
-- official one. Stored in the same units-per-USD direction as exchange_rates.
--
-- The existing line_items RLS policy covers all columns and enforces AAL2, so
-- the new columns inherit it — no policy change.
alter table public.line_items
  add column currency text check (currency in ('USD','EUR','VES')),
  add column rate_units_per_usd numeric(20,6) check (rate_units_per_usd > 0);
