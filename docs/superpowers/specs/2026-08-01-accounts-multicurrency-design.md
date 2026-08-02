# Accounts + multi-currency — design

**Date:** 2026-08-01
**Status:** Approved, ready for planning
**Ships as:** part of `v1.9` (chunks 1 and 2 of 3; see *Rollout*)

## Problem

The app tracks a month's budget but has no notion of *what you actually hold*. There is no
place to record that there is $2,430 in one bank account, €1,800 in another and Bs. 45,000 in
a third, and no single "amount available across everything" figure.

Separately, expenses can only be recorded in one implicit currency. An expense genuinely paid
in bolívares has to be mentally converted to dollars before entry, and once converted the
original amount and the rate used are both lost.

## Goals

1. Add accounts: named, emoji-tagged, manually-maintained balances in USD, EUR or VES.
2. Show per-currency subtotals plus one converted grand total in a chosen base currency.
3. Keep a **daily history** of exchange rates, so a past expense converts at the rate that was
   in force on the day it was paid — not today's rate.
4. Let an individual expense optionally carry its own currency, with the option to override the
   rate for that one expense.

## Non-goals

- **No bank connection.** Every balance is typed in by hand. No Plaid, no bank APIs, no OAuth.
- **No transaction ledger.** An account is a name and a current balance, not a running list of
  movements. The balance is authoritative because the user maintains it.
- **No link between accounts and expenses.** Paying an expense does not draw down an account
  balance. The two are independent views.
- **No drag-reorder** for accounts in this version. They sort by creation order.
- **No automatic rate fetching for past dates** beyond the EUR backfill described below.
- Accounts do **not** feed `BalanceHero`'s projected/actual figures. Those remain pure
  month-budget numbers. "Total available" is a separate figure shown alongside.

## Currency model

Three currencies, fixed in code, extended by editing one constant plus a check constraint:

```ts
// src/utils/currency.ts
export const CURRENCIES = {
  USD: { symbol: '$',   label: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€',   label: 'Euro',      locale: 'en-US' },
  VES: { symbol: 'Bs.', label: 'Bolívar',   locale: 'en-US' },
} as const;

export type Currency = keyof typeof CURRENCIES;
```

`Intl.NumberFormat` handles USD and EUR natively (`$1,234.50`, `€1,234.50`) but renders VES as
`VES 1,234.50`. Verified in Node 24. `formatCurrency` therefore formats VES as a decimal and
prefixes `Bs.` manually, and uses `Intl` currency style for the other two.

### Rates are stored as units-per-USD

Both upstream APIs already return this direction, and it is also the direction a human types an
override in ("800 bolívares to the dollar"), so it is stored verbatim with no reciprocal and no
round-trip precision loss:

| currency | `units_per_usd` | meaning              |
|----------|-----------------|----------------------|
| USD      | implicit `1`    | anchor, never stored |
| EUR      | `0.870700`      | €0.8707 per $1       |
| VES      | `746.629700`    | Bs. 746.63 per $1    |

Conversion between any two currencies goes through USD:

```
convert(amount, from, to, date)
  = amount * unitsPerUsd(to, date) / unitsPerUsd(from, date)
```

Because everything is anchored to USD, the user's chosen **base currency is purely a display
concern** — changing it never rewrites stored data.

### Rate resolution and carry-forward

`rateFor(currency, date)` returns:

1. `1` when `currency === 'USD'`.
2. The row for that exact `rate_date`, if present.
3. Otherwise **the most recent row strictly before that date** — carry-forward.
4. Otherwise `null`.

Carry-forward is required, not a nicety. The ECB does not publish on weekends or holidays —
verified: requesting `2026-05-01` from Frankfurter returns the `2026-04-30` rate — and the BCV
rate is only captured on days the app is actually opened.

A `null` result must render as an explicit "rate unknown" state with a link to enter one. It must
never fall back to `1`, and never silently omit the row from a total. A wrong total is worse than
a visibly incomplete one.

## Schema — `supabase/migrations/0018_accounts_and_currency.sql`

```sql
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

create table public.exchange_rates (
  user_id       uuid not null references auth.users on delete cascade,
  currency      text not null check (currency in ('EUR','VES')),
  rate_date     date not null,
  units_per_usd numeric(20,6) not null check (units_per_usd > 0),
  source        text not null check (source in ('ecb','bcv','manual')),
  fetched_at    timestamptz not null default now(),
  primary key (user_id, currency, rate_date)
);

alter table public.user_preferences
  add column base_currency text not null default 'USD'
    check (base_currency in ('USD','EUR','VES'));

alter table public.line_items
  add column currency text check (currency in ('USD','EUR','VES')),
  add column rate_units_per_usd numeric(20,6) check (rate_units_per_usd > 0);
```

Notes on the deliberate choices:

- **`balance numeric(16,2)`**, wider than the `numeric(12,2)` used elsewhere, because VES
  balances are routinely in the millions.
- **`exchange_rates` excludes USD** from its check constraint. USD is the anchor at a constant
  `1`; storing it would invite a row that contradicts the anchor.
- **`exchange_rates` is per-user** despite rates being global market data. This keeps the RLS
  shape identical to every other table (`user_id` + AAL2) rather than introducing a
  shared-table policy that any authenticated client could write to. At one user the duplication
  costs nothing.
- **`line_items.currency` is nullable with no default**, so existing rows need no backfill and
  read as "no currency set" — the same approach `paid_on` used in v1.8. `NULL` means the
  per-expense currency feature is off for that expense.
- **`rate_units_per_usd` is nullable**; `NULL` means "use that day's rate from the table".

Both new tables get RLS enabled and a policy in the **current wrapped form** established by
`0007_rls_perf.sql` — `(select auth.uid()) = user_id and ((select auth.jwt()) ->> 'aal') = 'aal2'`
— not the unwrapped form from `0002_rls.sql`.

No change to the signup seed trigger. Accounts start empty; the user adds their own. Rate rows
are created lazily on first fetch, the way `income` rows are.

## Rate sourcing

Both endpoints were probed on 2026-08-01. Both are free, require **no API key**, and return
`Access-Control-Allow-Origin: *`, so they are called directly from the browser with no proxy,
no Edge Function and no secret to manage.

### EUR — Frankfurter (European Central Bank reference rates)

```
GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR
    → {"amount":1.0,"base":"USD","date":"2026-07-31","rates":{"EUR":0.8707}}

GET https://api.frankfurter.dev/v1/2026-05-01..2026-05-05?base=USD&symbols=EUR
    → {"rates":{"2026-04-30":{"EUR":0.85455},"2026-05-04":{"EUR":0.8547}, ...}}
```

Supports single past dates and ranges, so **EUR history can be backfilled wholesale**. Stored
with `source = 'ecb'`. Note the response's own `date` field may precede the requested date on
weekends and holidays; store it under the date the API reports, and let carry-forward cover the
gap.

### VES — dolarapi (official BCV rate)

```
GET https://ve.dolarapi.com/v1/dolares/oficial
    → {"moneda":"USD","fuente":"oficial","promedio":746.6297,
       "fechaActualizacion":"2026-07-31T00:00:00-04:00"}
```

Exposes `oficial` (BCV) and `paralelo` separately; this app uses **`oficial` only**.

**dolarapi has no historical endpoint.** A `?fecha=` parameter was tested and is silently
ignored — it returns the current rate for any date requested. Alternatives were evaluated and
rejected: [Cotizave](https://cotizave.com/docs) has `GET /v1/fx/rates/:market/history` but
requires an `X-API-Key`, which cannot ship in a Vite bundle without exposing it, so it would
force an Edge Function; `bcvapi.tech` timed out on every probe and is not dependable.

VES history is therefore built by **recording forward**: each day the app is opened, that day's
official rate is captured. Dates before launch, and days the app was not opened, are filled by
hand through the rate editor. Rows are stored with `source = 'bcv'` or `'manual'`.

### Refresh behaviour

On app load, for each of EUR and VES, if there is no row for today, fetch and upsert it. Both
fetches are independent and **non-fatal**: a failure leaves the last known rate in place, and the
UI labels every rate with its source and age. There is also an explicit refresh control, and a
one-time "backfill EUR history" action covering the range of months that already have data.

## Per-expense currency

Each expense independently opts in — there is no global setting.

- Currency unset (`NULL`, the default): the expense behaves exactly as it does today.
- Currency set: the amount is entered in that currency, and converts using
  `rate_units_per_usd ?? rateFor(currency, effectiveDate)`.

**Effective date** is the expense's `paid_on` when set — this is the case that matters, so a
30,000 Bs expense paid on 1 May converts at 1 May's rate regardless of what BCV does later. When
unpaid, today's rate is used and the converted figure is marked as an estimate, since the money
has not actually moved yet.

The **rate override** exists because the official rate is not always the rate the user
transacted at. The input reads in the natural direction — type `800` meaning "800 Bs to the
dollar" — and an overridden expense shows a marker distinguishing it from one using the official
rate.

## UI surfaces

**Header** gains a 🏦 button, and `Page` in `App.tsx` gains `'accounts'`, following the exact
pattern the 📊 Insights button established in v1.6.

**Accounts page** (`src/pages/Accounts.tsx`) — accounts grouped by currency in `CURRENCIES`
declaration order, each group with a subtotal, then the grand total in the base currency. Rows
support inline rename, balance edit, currency change, emoji via the existing `EmojiPicker`, and
delete behind the `✕`→`✓` confirm pattern from `CategoryTable`. Deleting an account is
unconditional — nothing references it. Below the list sits the rates panel: today's rates with
source and age, a refresh control, the EUR backfill action, and an editable table of past dates
for filling VES gaps.

**Dashboard** gains a compact "Total available" card under `BalanceHero`, showing the grand
total and account count, linking through to the page. When a needed rate is missing it shows the
per-currency subtotals and a "set rates" link instead of a number.

**Expense rows** gain an optional currency control. With a currency set, the row shows the native
amount with the converted figure alongside (`Bs.30,000 ≈ $50.00`), plus the rate-override input.

The page loads its own data the way `CategoriesEditor` does rather than threading through `App`.
Edits save on blur with optimistic update and rollback-on-error, matching `reorderCategories`.

## Code layout

**New:** `src/utils/currency.ts` (constants, `formatCurrency`, `rateFor`, `convert`,
`subtotalsByCurrency`, `grandTotal` — all pure), `src/api/accounts.ts`, `src/api/rates.ts`
(including the two upstream fetches), `src/pages/Accounts.tsx`, `src/components/AccountRow.tsx`,
`src/components/ExchangeRatesPanel.tsx`, `src/components/RateHistoryEditor.tsx`,
`src/components/TotalAvailable.tsx` (one component, `compact` prop selects dashboard vs page).

**Modified:** `src/types.ts`, `src/App.tsx`, `src/components/Header.tsx`,
`src/components/LineItemRow.tsx`, `src/api/budget.ts` (thread `currency` and
`rate_units_per_usd`, presence-checked so an explicit `null` clears them, exactly as `paidOn` is
handled), `src/api/userPrefs.ts`, `src/pages/Settings.tsx` (base currency select),
`src/utils/money.ts`, `src/changelog.ts`, `CLAUDE.md`.

`formatCurrency(value, currency)` in `currency.ts` is the single real implementation.
`formatMoney(value)` in `money.ts` stays at its current one-argument signature and simply
delegates to `formatCurrency(value, 'USD')`, so every one of its existing call sites is
untouched and there is no second formatting implementation to drift.

Every total in the app routes through a single `convertedTotal()` helper rather than each
component re-implementing the conditional. This is the main structural risk in the design —
per-expense currency makes `BalanceHero`, `GrandTotals`, `IncomeSummary`, `CategoryTable`,
`Insights` and the CSV export all currency-aware — and one shared helper is what keeps that from
becoming six subtly different implementations.

## Error handling

| Condition | Behaviour |
|---|---|
| Rate API unreachable | Non-fatal. Keep last known rate, label with age. |
| No rate for a needed currency/date | Render "rate unknown" + link to enter one. Never assume `1`. |
| Rate row exists but is stale | Show normally with its age; visibly flag beyond 7 days. |
| Balance/name save fails | Roll back optimistic update, show inline error. |
| Duplicate account name | Caught by the unique constraint; surfaced as an inline message. |

## Testing

**Vitest.** `currency.test.ts` is the priority: formatting per currency including the `Bs.`
override and negatives, `rateFor` exact-match, `rateFor` carry-forward across a gap, `rateFor`
returning `null` before any known rate, conversion in both directions, USD anchor identity,
subtotals grouping, and grand total with a missing rate. Then `accounts` and `rates` API
snake_case↔camelCase mapping including the null-clearing paths, `AccountRow`,
`ExchangeRatesPanel`, `RateHistoryEditor`, `TotalAvailable` in both modes and its missing-rate
state, and `LineItemRow`'s currency control and override.

Upstream fetches are mocked in unit tests. No test hits a live rate API — that would make the
suite fail on a network blip and couple CI to a third party.

**Playwright.** `e2e/specs/accounts.e2e.ts` — create accounts in two currencies, assert the
per-currency subtotals, set a rate, assert the converted grand total, then delete.
`e2e/specs/expense-currency.e2e.ts` — set a currency on an expense, assert the converted figure,
apply a rate override, assert the figure changes and the marker appears.

**`e2e/support/seed.ts` must wipe `accounts` and `exchange_rates`** and reset `base_currency`
alongside the tables it already clears. The suite runs against a shared QA test user, so without
this, rows accumulate across runs and every subtotal assertion goes non-deterministic.

## Rollout

Lands on `staging` as two chunks, QA-smoked as each arrives:

1. Accounts page, multi-currency accounts, daily rate capture and the rates panel.
2. Per-expense currency and rate override.

Chunk 3 (receipt attachments, its own spec) follows. All three then merge to `main` as a single
`v1.9`, so PRD is smoked once. Per `CLAUDE.md`: direct push to `staging`, no PRs, and the
fast-forward to `main` is explicitly authorised by the user because it triggers the PRD deploy.

## Open risks

- **VES history before launch does not exist** and must be typed in for any past expense that
  needs it. This is inherent to there being no free keyless BCV history API, not a shortcut.
- **dolarapi is a single community dependency** with no SLA. Mitigated by rates being stored
  rather than fetched on demand — an outage degrades to a stale rate, never to a broken page —
  and by the manual editor always being available.
- **Per-expense currency touches every total in the app.** Mitigated by the single
  `convertedTotal()` helper and by the feature being off (`NULL`) unless explicitly set per
  expense.
