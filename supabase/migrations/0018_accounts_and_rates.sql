-- v1.9 chunk 1: manually-maintained account balances in multiple currencies,
-- plus a daily-resolution exchange-rate history.

-- Balances are signed: a negative balance models a credit card or overdraft.
-- numeric(16,2) rather than the (12,2) used elsewhere because VES balances
-- routinely run into the millions.
create table public.accounts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null,
  icon          text not null default '🏦',
  currency      text not null default 'USD' check (currency in ('USD','EUR','VES')),
  balance       numeric(16,2) not null default 0,
  display_order int not null,
  updated_at    timestamptz not null default now(),
  unique (user_id, name)
);

create index accounts_user_id_idx on public.accounts (user_id);

-- Rates are stored as units-per-USD, the direction both upstream APIs return
-- (EUR 0.870700 = €0.87 per $1; VES 746.629700 = Bs.746.63 per $1).
-- USD is the anchor at a constant 1 and is deliberately excluded from the
-- check constraint: storing it would allow a row contradicting the anchor.
create table public.exchange_rates (
  user_id       uuid not null references auth.users on delete cascade,
  currency      text not null check (currency in ('EUR','VES')),
  rate_date     date not null,
  units_per_usd numeric(20,6) not null check (units_per_usd > 0),
  source        text not null check (source in ('ecb','bcv','manual')),
  fetched_at    timestamptz not null default now(),
  primary key (user_id, currency, rate_date)
);

alter table public.accounts        enable row level security;
alter table public.exchange_rates  enable row level security;

create policy "own accounts, mfa required" on public.accounts
  for all
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

create policy "own exchange_rates, mfa required" on public.exchange_rates
  for all
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

-- Display-only: which currency the grand total is expressed in.
alter table public.user_preferences
  add column base_currency text not null default 'USD'
    check (base_currency in ('USD','EUR','VES'));
