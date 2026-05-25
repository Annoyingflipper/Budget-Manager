# Budget Manager — Design Spec

**Date:** 2026-05-25
**Status:** Approved — ready for implementation planning

---

## 1. Overview

A personal budgeting web app that tracks **projected** vs. **actual** amounts for monthly income and expenses, exposing the gap (Difference = Actual − Projected) at the row, category, and grand-total levels. Built single-user with auth + MFA from day one so it can scale to multi-device and shared budgets later without rework.

## 2. Goals

- Track projected and actual values for monthly income and eight expense categories.
- Compute and display Difference per line item, subtotal per category, and grand totals.
- Allow adding and deleting line items in each category.
- Show a Projected Balance and Actual Balance at the top of the page.
- Persist data across browsers and devices via a hosted backend.
- Secure account access with email + password and MFA (TOTP and/or WebAuthn passkey).

## 3. Non-goals (v1)

- Multi-month history or a month picker (current month only).
- User-defined categories beyond the fixed eight.
- Sharing budgets between users.
- Charts, reports, or analytics.
- Mobile-native apps (web only; responsive layout is enough).
- Offline-first behavior.

## 4. Tech stack

| Layer | Choice |
|---|---|
| Frontend framework | React 18 + Vite |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Backend | Supabase (Postgres + Auth + RLS) |
| Client SDK | `@supabase/supabase-js` |
| Testing | Vitest + React Testing Library |

No custom Node/Express server. The frontend talks to Supabase directly.

## 5. Repository structure

```
Budget-Manager/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── IncomeSummary.tsx
│   │   ├── BalanceCards.tsx
│   │   ├── CategoryTable.tsx
│   │   ├── LineItemRow.tsx
│   │   └── GrandTotals.tsx
│   ├── auth/
│   │   ├── AuthGate.tsx
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── MFAEnroll.tsx
│   │   └── MFAChallenge.tsx
│   ├── api/
│   │   └── budget.ts          # typed wrappers around supabase calls
│   ├── lib/
│   │   └── supabase.ts        # client init from env vars
│   ├── types.ts               # generated via `supabase gen types typescript`
│   └── utils/
│       └── money.ts           # formatting + difference math
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql      # tables
│   │   ├── 0002_rls.sql       # row-level security + AAL2 policies
│   │   └── 0003_seed_trigger.sql  # auto-seed categories on signup
│   └── config.toml            # local supabase project config
├── public/
├── .env.local                 # gitignored
├── .env.example               # template with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── package.json
└── README.md
```

## 6. Data model

All three tables are scoped per-user and protected by Row-Level Security.

```sql
-- One income row per user.
create table income (
  user_id    uuid primary key references auth.users on delete cascade,
  projected  numeric(12,2) not null default 0,
  actual     numeric(12,2) not null default 0,
  updated_at timestamptz   not null default now()
);

-- Eight categories per user, seeded automatically on signup.
create table categories (
  id            bigint generated always as identity primary key,
  user_id       uuid          not null references auth.users on delete cascade,
  name          text          not null,
  display_order int           not null,
  unique (user_id, name)
);

create table line_items (
  id          bigint generated always as identity primary key,
  user_id     uuid           not null references auth.users on delete cascade,
  category_id bigint         not null references categories on delete cascade,
  name        text           not null,
  projected   numeric(12,2)  not null default 0,
  actual      numeric(12,2)  not null default 0,
  created_at  timestamptz    not null default now()
);

create index line_items_category_id_idx on line_items (category_id);
create index line_items_user_id_idx     on line_items (user_id);
```

**Derived values are never stored.** `difference`, `subtotal`, `grand total`, and `balance` are computed in the UI from the live state.

### Seed trigger

A Postgres trigger on `auth.users` inserts the eight default categories whenever a new user signs up:

```
Services, Entertainment, Loans, Taxes,
Savings or Investments, Monthly Payments, Personal Care, Other
```

`display_order` is assigned 1..8 in that order. The trigger also inserts the singleton `income` row with both values at 0.

### Row-Level Security

```sql
alter table income     enable row level security;
alter table categories enable row level security;
alter table line_items enable row level security;

-- Policy applied to all three tables: own rows only, AAL2 required.
create policy "own rows, mfa required" on line_items
  for all
  using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  );
-- (same policy applied to income and categories)
```

Effect: the budget data is unreadable and unmodifiable until the user has completed MFA in the current session.

## 7. Data layer (`src/api/budget.ts`)

The frontend never makes raw `supabase.from(...)` calls from components. All access goes through typed wrappers:

```ts
// Signatures only — implementation deferred to the plan.
getBudget():        Promise<Budget>                    // single round trip on load
updateIncome(p: { projected?: number; actual?: number }): Promise<void>
addLineItem(categoryId: number, item: { name: string; projected: number; actual: number }): Promise<LineItem>
updateLineItem(id: number, patch: Partial<LineItem>):   Promise<void>
deleteLineItem(id: number):                             Promise<void>
```

`Budget` is shaped as `{ income, categories: [{ ...category, items: [...] }] }` so the dashboard loads in one query.

## 8. UI layout

```
┌──────────────────────────────────────────────────────────────┐
│  Budget — May 2026                                  [logout] │
├──────────────────────────────────────────────────────────────┤
│  INCOME                                                      │
│  Projected: $1,520     Actual: $1,400    Difference: -$120  │
│                                                              │
│  Projected Balance: $XYZ     Actual Balance: $XYZ           │
├──────────────────────────────────────────────────────────────┤
│  ▼ Services                                                  │
│  ┌────────────┬──────────┬─────────┬───────────┬───┐         │
│  │ Name       │ Projected│ Actual  │ Difference│ ✕ │         │
│  ├────────────┼──────────┼─────────┼───────────┼───┤         │
│  │ Claude     │   20.00  │  20.00  │    0.00   │ ✕ │         │
│  │ Netflix    │   15.00  │  17.00  │   +2.00   │ ✕ │ (red)   │
│  │ + Add item │          │         │           │   │         │
│  ├────────────┼──────────┼─────────┼───────────┼───┤         │
│  │ Subtotal   │   35.00  │  37.00  │   +2.00   │   │         │
│  └────────────┴──────────┴─────────┴───────────┴───┘         │
│                                                              │
│  ▼ Entertainment   ... (same shape)                          │
│  (6 more categories)                                         │
├──────────────────────────────────────────────────────────────┤
│  GRAND TOTALS                                                │
│  Total Projected: $X   Total Actual: $X   Total Diff: $X    │
└──────────────────────────────────────────────────────────────┘
```

### Components

- **`App.tsx`** — owns the loaded budget state. Renders `IncomeSummary`, eight `CategoryTable`s, and `GrandTotals`. Receives derived totals as props or via a small helper.
- **`IncomeSummary.tsx`** — two editable number inputs (projected, actual), one computed Difference, plus two Balance values.
- **`BalanceCards.tsx`** — rendered inside `IncomeSummary`. Displays Projected Balance and Actual Balance.
- **`CategoryTable.tsx`** — receives one category with its items. Renders the header row, item rows, the "+ Add item" row, and the subtotal row.
- **`LineItemRow.tsx`** — three editable inputs (name, projected, actual), a computed Difference cell, and a delete button. Owns its own draft state, fires save-on-blur.
- **`GrandTotals.tsx`** — sums across all categories.

### Interactions

- Every editable cell is an always-on input (`<input type="text">` for name, `<input type="number" step="0.01">` for money). No edit/view mode toggle.
- **Save-on-blur:** when an input loses focus and its value differs from the last persisted value, fire the corresponding API call. Optimistic UI updates immediately; on error, revert and show a small inline error.
- **Add item:** "+ Add item" inserts a new row pre-focused on the name input with all numbers at 0. The row exists in local state only until the name input loses focus with a non-empty value, at which point it is persisted via `addLineItem`. If the user blurs the name input while empty, the draft row is discarded from local state — no API call is made.
- **Delete item:** ✕ shows a small inline confirm ("Delete?") before firing the API call.
- **Reset / new month:** explicitly deferred. Not in v1.

### Color rules (Difference cell + subtotal + grand-total difference cells)

- **Income row:** positive difference = green (earned more than projected). Negative = red.
- **Cost row, category subtotal, grand-total cost difference:** positive difference = red (over budget). Negative = green (under budget).
- **Zero or empty:** neutral gray.

The rule for each cell type is encoded in `utils/money.ts` as `differenceClass(role: 'income' | 'cost', value: number) → 'text-green-600' | 'text-red-600' | 'text-gray-500'`.

### State management

Plain React `useState` at `App` level for the loaded budget. Children receive slices and onChange callbacks via props. No Zustand, Redux, or context store — total row count is bounded (8 categories × ~10 items per category is the realistic ceiling).

## 9. Auth flow

### Sign-up
1. User enters email + password on `Signup`.
2. Supabase creates the `auth.users` row. The trigger fires immediately and seeds the user's eight categories and income singleton.
3. Supabase sends a verification email. The user cannot sign in until the email is verified.
4. After first successful sign-in, the user lands on `MFAEnroll` and **must** enroll at least one factor before reaching the budget.

### MFA enrollment (`MFAEnroll`)
- Lists currently enrolled factors.
- Offers two enrollment buttons:
  - **Add authenticator app (TOTP)** — shows QR code and secret. User enters first 6-digit code to verify.
  - **Add passkey (WebAuthn)** — invokes the platform authenticator (Touch ID, Face ID, Windows Hello, security key).
- After at least one factor is enrolled, "Continue" advances the session to AAL2 and routes to the budget.

### Login (returning user)
1. `Login` collects email + password.
2. On success, `MFAChallenge` opens and renders one of three states based on the user's enrolled factors:
   - **Passkey only:** trigger the WebAuthn prompt. (Single "Try again" button on failure.)
   - **TOTP only:** show the 6-digit code input.
   - **Both enrolled:** show the passkey prompt by default with a "Use authenticator code instead" link that swaps to the TOTP input.
3. On factor verification, session becomes AAL2 and the user lands on the budget. A user with at least one factor enrolled cannot reach the budget without satisfying the challenge.

### `AuthGate`
Wraps the app. Reads session and AAL. Routes:
- No session → `Login` / `Signup`.
- Session but AAL1 and no factors enrolled → `MFAEnroll`.
- Session but AAL1 and factors enrolled → `MFAChallenge`.
- Session at AAL2 → budget app.

### Implementation reference
Supabase MFA methods used (signatures only; details in implementation plan):
- `supabase.auth.signUp`, `supabase.auth.signInWithPassword`
- `supabase.auth.mfa.enroll`, `supabase.auth.mfa.challenge`, `supabase.auth.mfa.verify`, `supabase.auth.mfa.listFactors`, `supabase.auth.mfa.unenroll`

## 10. Testing

- **Unit (Vitest):** `utils/money.ts` — formatting, `differenceClass`, subtotal/balance math. Pure functions, full coverage.
- **Component (Vitest + RTL):** `LineItemRow` save-on-blur behavior, optimistic update and revert on simulated error.
- **Auth:** manual smoke testing for v1. Automated tests for the auth flow are out of scope.
- **No E2E** in v1.

## 11. Environment & secrets

- `.env.local` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `.env.example` committed with placeholder values.
- The anon key is safe to ship in the client because RLS + AAL2 enforce all access control.

## 12. Out of scope for v1 — explicit future work

- Month rollover and historical view.
- User-editable category list.
- Sharing a budget with another user (extend RLS policies, add a `budget_members` table).
- Charts and analytics.
- CSV import/export.
- Recurring item templates.
- Email reminders.
- Mobile-optimized layout polish.
