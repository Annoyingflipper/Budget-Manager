-- v1.4: add a period_month dimension to income and line_items.
-- Backfill = 2026-06-01 (existing data represents the user's June 2026 plan).

-- income: add column, backfill, repoint PK, enforce first-of-month.
alter table public.income add column period_month date;
update public.income set period_month = date '2026-06-01' where period_month is null;
alter table public.income alter column period_month set not null;
alter table public.income drop constraint income_pkey;
alter table public.income add constraint income_pkey primary key (user_id, period_month);
alter table public.income
  add constraint income_period_first_of_month
  check (period_month = date_trunc('month', period_month)::date);

-- line_items: add column, backfill, index, enforce first-of-month.
alter table public.line_items add column period_month date;
update public.line_items set period_month = date '2026-06-01' where period_month is null;
alter table public.line_items alter column period_month set not null;
create index line_items_user_period_idx on public.line_items (user_id, period_month);
alter table public.line_items
  add constraint line_items_period_first_of_month
  check (period_month = date_trunc('month', period_month)::date);
