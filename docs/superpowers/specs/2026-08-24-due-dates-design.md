# v2.0 — Due dates & "Coming up"

**Date:** 2026-08-24
**Status:** Approved design, ready for implementation planning

## Problem

The app records **what** is owed but has no notion of **when**. `line_items`
carries `paid_on` (v1.8) and nothing else temporal, so `StillToPay` can say
*"8 items, $1,240 outstanding"* but cannot say which of those is late, which
lands on Friday, or whether the money on hand covers what is about to leave.

That gap matters more here than it would in a single-currency app. Account
balances are maintained by hand across USD / EUR / VES, so the only way to
answer *"can I cover what's due this week?"* today is to read every row and
add it up mentally.

v2.0 adds the missing axis: a due date per expense, a bucketed summary of what
is outstanding, and a single line comparing that against what the accounts hold.

## Scope

**In:**
- `line_items.due_on` — nullable date, per expense
- `rollover_month` carries the due day into the target month (clamped)
- `rollover_month` also carries `currency` and `rate_units_per_usd` — **bug fix**
- Overdue / due-soon / later bucketing, computed client-side
- A `ComingUp` dashboard panel with a cash-flow verdict line
- A `DateCell` component shared by the Paid and Due controls
- A repo cleanup pass (see "Cleanup", below)

**Out (explicitly deferred):**
- Reminders, notifications, email — no delivery channel exists and none is wanted
- Recurring-bill templates — `rollover_month` already covers the recurring case
- Cross-month bill inbox — the panel is month-scoped by decision (see below)
- Auto-marking a bill paid when its due date passes — due is a plan, paid is a fact

## Decisions

### A full date, not a day-of-month

`due_on date` mirrors `paid_on` exactly. The alternative — `due_day smallint`
(1–31) — makes rollover trivial but cannot express a one-off bill, and forces
every display site to synthesise a real date from `period_month` and re-derive
the month-length clamp. Storing the date once means clamping happens once, in
the rollover RPC, instead of at every render.

### The panel is scoped to the selected month

Every existing dashboard component (`BalanceHero`, `StillToPay`,
`GrandTotals`) is month-scoped. A panel that reached into the next month would
be the only element on the page that could disagree with the rows beneath it,
and would need a second `getBudget` call plus its own loading state.

The cost is real and accepted: on 30 August, September's rent is not shown
while August is selected. It appears as soon as September is selected, and
rollover makes September exist the moment the user presses "Start September".

### Buckets are derived, never stored

`due_on` is the only new stored fact. Overdue / soon / later are pure functions
of `(due_on, paid_on, today)`, recomputed on render. Nothing to migrate, nothing
to invalidate at midnight, and the entire rule set is unit-testable without a
database.

### Date arithmetic stays on strings

`new Date('2026-08-05')` parses as **UTC midnight**, which in a
western-hemisphere timezone is 4 August local. Routing due dates through `Date`
would mislabel bills as overdue by one day, intermittently and only for users
west of UTC — precisely the kind of bug that survives review.

All comparison and arithmetic therefore operates on `YYYY-MM-DD` strings, which
sort lexicographically by construction. `date.ts` gains `addDays(iso, n)`
implemented with explicit component math, matching the existing `todayISO()`.

## Data layer

### Migration `0021_line_item_due_on.sql`

```sql
alter table public.line_items add column due_on date;
```

Nullable, no default, no constraint, no backfill — the same shape `0017` used
for `paid_on`. `NULL` means "no due date", which is what every existing row
gets and what the UI treats as unremarkable. No date constraint: a bill
belonging to August may legitimately be due in early September. Existing
`line_items` RLS select/update policies are column-agnostic and already enforce
AAL2, so the new column inherits them unchanged.

The same migration replaces `rollover_month`:

```sql
insert into public.line_items
  (user_id, category_id, name, projected, actual, period_month,
   currency, rate_units_per_usd, due_on)
select uid, category_id, name, projected, 0, to_month,
       currency, rate_units_per_usd,
       case when due_on is null then null
            else to_month + least(
                   extract(day from due_on)::int,
                   extract(day from (to_month + interval '1 month' - interval '1 day'))::int
                 ) - 1
       end
from public.line_items
where user_id = uid and period_month = from_month;
```

`least(...)` is the month-length clamp: a bill due the 31st rolls into February
as the 28th (29th in a leap year). `to_month + N` adds N days to a date, hence
the `- 1`.

`paid_on` remains deliberately uncopied. A rolled-over month starts unpaid;
that is the whole point of rolling over.

### The bug this fixes

`rollover_month` has inserted a fixed column list since v1.4 (`0011`). v1.9
chunk 2 (`0019`) added `currency` and `rate_units_per_usd` to `line_items` but
never revisited the RPC. **Every rollover since has silently reset foreign
expenses to the base currency**, changing the month's totals without any
visible error. Adding `due_on` requires touching the same statement, so the fix
lands here rather than waiting for its own patch release.

### API changes — `src/api/budget.ts`

- `due_on` added to the three `select` column lists (lines ~70, ~186, ~238)
- `dueOn: (raw.due_on as string | null) ?? null` in both row mappers
- `updateLineItem` accepts `dueOn` and writes it **presence-checked**:
  `if ('dueOn' in patch) dbPatch.due_on = dueOn;` — so an explicit `null`
  clears the date, while an absent key leaves it alone. Identical to `paidOn`.
- `addLineItem` accepts an optional `dueOn`

`src/types.ts` — `LineItem` gains `dueOn: string | null`.

`due_on` is **not** added to `ExportRow`/CSV in this version. The export is a
money document; adding a schedule column changes its shape for every consumer
and belongs to its own decision.

## Pure logic — `src/utils/dueStatus.ts`

```ts
export type DueBucket = 'overdue' | 'dueSoon' | 'later';
export type DueGroup  = { items: LineItem[]; count: number; amount: number };
export type DueSummary = {
  overdue: DueGroup; dueSoon: DueGroup; later: DueGroup;
  /** overdue.amount + dueSoon.amount — what the verdict line compares. */
  actionableAmount: number;
  /** True when no unpaid, dated item exists — the panel hides. */
  isEmpty: boolean;
};

export function summariseDue(
  categories: CategoryWithItems[], today: string, horizonDays?: number
): DueSummary;

/** One item's bucket, or null when it is paid or has no due date. */
export function bucketFor(
  item: LineItem, today: string, horizonDays?: number
): DueBucket | null;
```

`summariseDue` is what `ComingUp` renders; `bucketFor` is what `LineItemRow`
asks to decide whether to tone a row overdue. Both apply the same rules below,
so a row can never disagree with the panel.

Rules, in order:

| Condition | Result |
|---|---|
| `paidOn !== null` | excluded entirely — a paid bill is not due |
| `dueOn === null` | excluded from all buckets; still counted by `StillToPay` |
| `dueOn < today` | `overdue` |
| `today <= dueOn <= today+7` | `dueSoon` |
| `dueOn > today+7` | `later` |

`horizonDays` defaults to 7 and exists so tests can pin it rather than to
expose a setting.

Amounts sum `baseProjected`, consistent with every money total in the app since
v1.9 chunk 2 — never the native `projected`, which would add bolívares to
dollars. Items within a group sort by `dueOn` ascending.

`stillToPay.ts` is left untouched: it answers "what is unpaid", which stays
correct and independent of whether a date was ever entered.

## UI

### `src/components/ComingUp.tsx`

```
⏰ Coming up — August

  Overdue         2 items   $310      ← --negative
  Due in 7 days   3 items   $845      ← --warning (v1.7 token)
  Later           1 item    $ 90      ← --muted
  ──────────────────────────────────
  $1,155 due soon · $2,410 available
  ✓ Covered   (balances as you last set them)
```

- Returns `null` when `summary.isEmpty` — the dashboard is visually unchanged
  until due dates are actually used. No empty state, no "add your first due
  date" prompt.
- Each bucket row is a `<button aria-expanded>` toggling a list of its items
  (name · due date · base amount). Collapsed by default.
- Verdict compares `actionableAmount` against
  `grandTotal(accounts, base, rates, today)`:
  - total `null` → *"Set an exchange rate to compare"*, matching what
    `TotalAvailable` already renders in that case
  - covered → *"✓ Covered"*
  - short → *"Short by <amount>"* in `--negative`
  - the *"balances as you last set them"* caveat always shows, because account
    balances are hand-maintained and may be stale
- Mounts in `App.tsx` between `<StillToPay>` and `<UnresolvedRatesNotice>`,
  receiving `categories`, `accounts`, `rates`, `base`.

### `src/components/DateCell.tsx`

Both date controls collapse into one component. They differ only in their empty
state, so the caller supplies it:

```tsx
<DateCell value={item.paidOn} onSave={savePaidOn} label="Paid date"
          empty={{ label: 'Mark paid', onClick: () => savePaidOn(todayISO()) }} />

<DateCell value={item.dueOn} onSave={saveDueOn} label="Due date"
          empty={{ label: '＋ due', onClick: () => setEditing(true) }}
          tone={isOverdue ? 'overdue' : undefined} />
```

`DateCell` holds internal `editing` state and renders the `<input type="date">`
when `value !== null || editing` — otherwise clicking "＋ due" on an item with no
date would have nothing to type into. `empty.onClick` is what flips `editing`;
for Paid it instead stamps today directly and never sets it. Blurring an input
that was left empty clears `editing` and saves `null`.

The set state pairs the input with an `✕` clear button (`aria-label="Clear due
date"`). Paid keeps its existing `✓` "Mark unpaid" toggle rather than being
harmonised — it is an established control with E2E coverage, and the two
affordances mean different things. Due deliberately does **not** stamp today on click —
"due today" is a claim, not a sensible default. `tone="overdue"` adds a
negative-coloured ring.

Both keep their existing draft-state pattern: local `useState` synced from
props via `useEffect`, saved on blur.

### Grid columns

Desktop goes from 7 columns to 8. Paid and Due shrink to 104px each:

```
before  1.4fr 76px 76px 58px 76px 138px       24px
after   1.4fr 76px 76px 58px 76px 104px 104px 24px
         name  proj  act  cur  diff  paid   due  ✕
```

Inside `max-w-3xl` that leaves the name input about 160px (720px content −
518px fixed − 42px of gaps). Workable, but the tightest the row has been. If it
reads as cramped during QA the Diff column drops to 68px before anything else
gives — it holds a formatted amount and nothing else.

This template is currently duplicated as a literal in both `LineItemRow.tsx`
and `CategoryTable.tsx`, which is how they can drift. It moves to one exported
constant — `ROW_GRID` in `CategoryTable.tsx` — imported by both.

Mobile (`useIsMobile`) turns the existing Paid/Currency pair into a 2×2 grid
with Due, following the pattern `AccountRow` established in v1.9.

### File sizes

`LineItemRow.tsx` is 398 lines today, the largest in the repo, and the Due
column lands squarely inside it. Extracting `DateCell` brings it to roughly 260
even after the new control — a targeted improvement to code this version is
already editing, not a speculative refactor.

## Cleanup

Bundled into this version, agreed separately from the feature work.

| Item | Action | Risk |
|---|---|---|
| `dist/`, `dist-tsc-node/`, `test-results/`, `tsconfig.tsbuildinfo`, `.DS_Store` | delete | none — all gitignored build output, regenerated on demand |
| `.env.production.local` | show contents, then delete on confirmation | `npm run build` runs Vite in production mode and loads it, so a local build bakes **PRD** Supabase credentials into `dist/`. Vercel injects its own values, so the file's only effect is that foot-gun |
| `src/api/preferences.ts` + `src/api/userPrefs.ts` | merge into `userPrefs.ts` | both hit `user_preferences`; each carries a private duplicate of `currentUserId()`. `ThemeProvider.tsx` + its test update their import path |
| `CLAUDE.md` v1.9 entry | fix | the chunk-2 sentence is stranded at the end of the chunk-3 bullet, and the stated test counts contradict each other |
| Test count in `CLAUDE.md` | correct to the real number | actual is **340**, not 336 — `e2e/support/totp.test.ts` falls inside Vitest's default include glob and runs with the unit suite |

No other dead code was found: every module under `src/utils/` and `src/api/`
is imported by at least one non-test file, and both `tsc --noEmit` and
`tsc -p tsconfig.e2e.json` are clean.

## Testing

### Vitest

- **`dueStatus`** — each bucket; the `today` and `today+7` boundaries on both
  sides; paid items excluded; `dueOn === null` excluded; empty input;
  `actionableAmount` excludes `later`; amounts use `baseProjected` for a
  mixed-currency set; items sorted by date
- **`date.addDays`** — month rollover, year rollover, leap-day, negative n
- **`DateCell`** — renders empty state, fires `empty.onClick`, saves on blur,
  clears to `null`, applies the overdue tone
- **`ComingUp`** — three populated buckets; hidden when empty; expand/collapse;
  covered; short; `grandTotal === null`
- **`budget.ts`** — `due_on` ↔ `dueOn` both directions; presence-check clears
  to `null`; an absent key leaves the column untouched
- **`LineItemRow`** — due control renders and saves; overdue styling

### Playwright — `e2e/specs/due-dates.e2e.ts`

1. Set a due date in the past → row shows overdue, `ComingUp` counts it
2. Set one within the week → lands in "Due in 7 days"
3. Mark it paid → drops out of the panel entirely
4. **Rollover regression:** create a EUR expense with a due date, roll the
   month forward, assert the copied row retains **both** its currency **and**
   a due date on the same day-of-month.

Step 4 is the reason the RPC bug gets a real-browser test rather than a unit
test — only a round-trip through Postgres exercises the column list.

New Vitest count lands around 375; the suite must stay green, along with both
typechecks.

## Rollout

Single chunk — one migration, one smoke, comparable in size to v1.7. The
three-chunk treatment v1.9 needed is not warranted here.

1. `staging` → QA smoke, apply `0021` to QA first
2. Verify a rollover on QA carries currency + due date (the bug fix)
3. Fast-forward `main` on explicit authorisation → apply `0021` to PRD
4. PRD smoke
5. Notion `v2.0 Smoke Tests` sub-page + hub Versions index

`0021` is additive and the RPC replacement is backward-compatible with the
current client, so a deploy that lands before the migration degrades to
"no due dates" rather than erroring.
