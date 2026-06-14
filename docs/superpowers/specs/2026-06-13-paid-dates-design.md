# v1.8 — Paid dates for line items

**Date:** 2026-06-13
**Status:** Approved (design)
**Author:** session handoff with `annoyingflipper@gmail.com`

## Summary

Let the user record **when** each payment was paid. Each line item gets one
optional "paid on" date. A blank date means the bill is not paid yet. This
unlocks two derived features in the same version:

1. **Unpaid / paid visual state** on each row — at a glance, what is still
   outstanding this month.
2. **"Still to pay" summary** — total dollars and count of bills not yet paid
   for the selected month.

Deferred to a future version (explicitly out of scope here): overdue
highlighting (needs a per-item due day) and adding the paid date to the
Insights CSV export.

## Goals

- Record a single optional paid date per line item, scoped to the month the
  item already belongs to.
- Make paid vs. unpaid obvious in the dashboard without extra clicks.
- Surface a single "still to pay" figure for the current month.
- Keep the change additive: no auth, theme, rollover, or insights changes.

## Non-goals

- Multiple installments / partial payments per item (single date only).
- A separate paid/unpaid status field distinct from the date (the date *is*
  the status: present = paid, null = unpaid).
- Overdue / due-date logic.
- Paid date in CSV export.

## Data model

One new nullable column on `line_items`.

```sql
-- supabase/migrations/0017_line_item_paid_on.sql
-- v1.8: record when each line item was paid. NULL = unpaid.
alter table public.line_items add column paid_on date;
```

Decisions:

- **Nullable, no default.** Every existing and new item starts unpaid. No
  backfill needed.
- **No date constraint.** Unlike `period_month` (which is pinned to the first
  of the month), `paid_on` accepts any date — a bill for June may be paid in
  late May or early July.
- **No RLS change.** The existing `line_items` select/update policies already
  cover all columns and enforce AAL2. The new column inherits them.

## API & types

### `src/types.ts`

`LineItem` gains a camelCase field:

```ts
export type LineItem = {
  id: number;
  category_id: number;
  name: string;
  projected: number;
  actual: number;
  paidOn: string | null; // ISO 'YYYY-MM-DD', or null when unpaid
};
```

### `src/api/budget.ts`

- `getBudget` — add `paid_on` to the `line_items` select; normalize each row's
  `paid_on` to `paidOn` (string or `null`).
- `getExportRows` — unchanged (CSV paid-date is out of scope).
- `addLineItem` — insert with no `paid_on`; the returned/normalized item has
  `paidOn: null`.
- `updateLineItem` — patch type gains `paidOn?: string | null`. Because the
  column is snake_case while the rest of the patch keys already match their
  column names, translate `paidOn → paid_on` before calling `.update()`
  (today the function passes the patch object straight through). Other keys
  pass through unchanged.

## Row UI — `src/components/LineItemRow.tsx`

Add a paid control to each row, following the file's existing
optimistic-update-with-rollback pattern (same shape as `saveProjected` /
`saveActual`).

- **Unpaid state** (`paidOn === null`): a subtle "unpaid" marker (small dot)
  plus a **"Mark paid"** button. Tapping it sets `paidOn` to **today**
  (`YYYY-MM-DD`), optimistically, and persists via
  `updateLineItem(id, { paidOn: today })`, rolling back on error.
- **Paid state** (`paidOn` set): a **✓** and an editable `<input type="date">`
  bound to the date. Changing the day calls
  `updateLineItem(id, { paidOn: nextDate })`. **Clearing** the input sets
  `paidOn` back to `null` (un-pays the item).
- Respect the existing mobile/desktop layout split (`useIsMobile`). On mobile
  the control stacks like the other fields; on desktop it sits inline with the
  amount columns.

"Today" is computed from the local clock at click time. When the user is
viewing a past or future month, today's date may fall outside that month —
that is allowed (see data-model "no date constraint"); the user can edit the
day afterward.

## "Still to pay" summary

### Pure util — `src/utils/stillToPay.ts`

```ts
stillToPay(categories: CategoryWithItems[]): { count: number; amount: number }
```

- Iterates every line item across all categories for the selected month.
- An item counts as outstanding when `paidOn === null`.
- `count` = number of outstanding items.
- `amount` = sum of the **projected** value of outstanding items. Rationale:
  an unpaid item's `actual` is usually still 0, so `projected` is the real
  expected outstanding cost.

### Component — `src/components/StillToPay.tsx`

- Rendered in `src/App.tsx` directly under `<IncomeSummary>` and above the
  category list (it summarizes across all categories).
- Outstanding state: e.g. **"3 bills left · $420 still to pay"** (count +
  `formatMoney(amount)`).
- All-paid state (`count === 0`): a tidy **"✓ All paid this month"**.

## Testing

### Vitest (mocked)

- `stillToPay` util: no items, all paid, all unpaid, mixed; verifies count and
  projected-sum.
- `LineItemRow`: "Mark paid" stamps today and persists; editing the date
  persists; clearing the date un-pays; rollback on a failed update.
- `StillToPay`: renders the outstanding line and the all-paid line.

### Playwright E2E — `e2e/paid-dates.e2e.ts`

(Per the project rule: a Playwright spec for every new feature.)

- Mark a bill paid → the date persists across reload and the "still to pay"
  count/amount drops.
- Clear the date → the item returns to unpaid and the summary increases again.
- Reseed/baseline handling consistent with the existing E2E fixtures.

## Out of scope / future versions

- Overdue highlighting with a per-item due day.
- Paid date as a CSV export column.
- Multiple installments per item.

## Rollout

Standard flow: branch `staging` → QA smoke on the QA Vercel URL → fast-forward
merge to `main` (user authorizes the PRD push) → PRD smoke → Notion
`v1.8 Smoke Tests` sub-page + Versions index update.
