# v1.7 — Delete future months + Per-category budget health

**Date:** 2026-06-11
**Status:** Approved (brainstorm)

Two independent, frontend-leaning features shipped together as v1.7:

1. **Delete future months** — remove a month created by accident (any month strictly after the present calendar month).
2. **Per-category budget health** — a visual progress bar per category with under / near / over states.

Neither touches auth. Feature A adds one Postgres RPC; Feature B is frontend + a CSS theme token. Both ship with Vitest **and** Playwright E2E coverage.

---

## Feature A — Delete future months

### Problem

Rollover (`rollover_month` RPC) lets the user create the next month. If they roll over by accident — creating a future month they didn't want — there is no way to remove it. Months are independent rows keyed by `period_month` on `income` + `line_items`; deleting a month just means removing that user's rows for that `period_month`.

Scope decision: **any month strictly after the present calendar month is deletable.** Past months and the current month are protected (they hold real data).

### Backend — `delete_month(target_month date)` RPC

New migration `supabase/migrations/0016_delete_month_rpc.sql`, mirroring `rollover_month` exactly (`language plpgsql`, `security invoker`, `set search_path = public`). Guards, in order:

1. `auth.uid()` is null → `raise exception 'not authenticated'`
2. `auth.jwt() ->> 'aal' <> 'aal2'` → `raise exception 'mfa required'`
3. `target_month` is null → `raise exception 'target_month required'`
4. `target_month <> date_trunc('month', target_month)::date` → `raise exception 'month must be the first of the month'`
5. **`target_month <= date_trunc('month', current_date)::date`** → `raise exception 'cannot delete current or past months'`

Then, for `user_id = uid and period_month = target_month`:

```sql
delete from public.line_items where user_id = uid and period_month = target_month;
delete from public.income     where user_id = uid and period_month = target_month;
```

`grant execute on function public.delete_month(date) to authenticated;`

RLS still applies (security invoker), so the function can only ever touch the caller's own rows. The AAL2 guard matches the existing budget-read RLS requirement.

**Timezone note:** the server's "current month" uses `current_date` (UTC); the client computes the current month from local time. At a month boundary across timezones these could differ by one day. This is negligible for a solo user, and the **server guard is authoritative** — the client check is only for showing/hiding the button.

### API — `src/api/budget.ts`

```ts
export async function deleteMonth(targetMonth: string): Promise<void> {
  const { error } = await supabase.rpc('delete_month', { target_month: targetMonth });
  if (error) throw error;
}
```

Same shape as `rolloverMonth`.

### UI — `Header.tsx` + `App.tsx`

- `App` computes `canDelete = selectedMonth > formatMonth(new Date())` and passes `canDelete: boolean` + `onDelete: () => void` to `Header`.
- `Header` renders a small **`🗑 Delete this month`** button next to the month switcher, **only when `canDelete` is true**. It coexists with the existing prev/next/rollover controls in the flex-wrap row.
- `handleDelete` in `App`:
  1. `window.confirm("Delete <Month YYYY>? This permanently removes all income and line items for that month.")` (same `window.confirm` pattern as rollover).
  2. On confirm: `await deleteMonth(selectedMonth)`.
  3. `setSelectedMonth(prevMonth(selectedMonth))` — since deletable months are strictly future, the previous month is always the current month or earlier, which is always safe to load.
  4. Bump `refreshCounter` so the `listMonths` / `latestMonth` effect recomputes.
  5. Errors → `setError`.
  6. A declined confirm is a no-op.

---

## Feature B — Per-category budget health

### Problem

`CategoryTable` already shows a subtle `"$X over / $X under / on budget"` text in its header and a subtotal row. What's missing is a **visual** at-a-glance signal of how close each category is to its projected budget. Add a progress bar with three states.

### Logic — `src/utils/budgetHealth.ts`

```ts
export type BudgetState = 'empty' | 'under' | 'near' | 'over';

export type BudgetStatus = {
  ratio: number;   // actual / projected, clamped to [0, 1] for the fill width
  state: BudgetState;
  overBy: number;  // max(0, actual - projected), rounded to cents
};

export function categoryBudgetStatus(projected: number, actual: number): BudgetStatus;
```

Rules (evaluated in order):

- `projected === 0 && actual === 0` → `empty` (ratio 0, overBy 0).
- `actual > projected` (includes `projected === 0 && actual > 0`) → `over` (ratio clamped to 1).
- `actual / projected >= 0.9` → `near`.
- otherwise → `under`.

`ratio` for the fill is `projected > 0 ? min(actual / projected, 1) : (actual > 0 ? 1 : 0)`. `overBy = roundCents(max(0, actual - projected))`.

### UI — `src/components/CategoryBudgetBar.tsx`

A thin rounded track with a fill bar, rendered in `CategoryTable` just under the header row (around current line 64, before the column-label grid).

- Fill width = `ratio * 100%`.
- Color via theme tokens: `under` → positive/accent token, `near` → new `--warning` amber token, `over` → negative token (fill clamped to 100%).
- `empty` → no bar, or a faint empty track (decided at implementation; default to rendering nothing to avoid clutter for never-budgeted categories).
- The existing `"$X over / under / on budget"` header text stays; in the `over` state it is emphasized.
- `aria-label` describing the state, e.g. `"Groceries: 80% of projected spent"` / `"Groceries: over budget by $40"`. The Settings axe scan runs the full `wcag2a`/`wcag2aa` ruleset, so color is never the sole signal — the text + aria-label carry meaning.

### Theme — `src/themes.css`

Add a `--warning` amber token to each theme (peach / sage / lavender), with light and dark variants, chosen to meet WCAG AA contrast in the same spirit as the recent `--muted` darkening work. The `near` state uses this token.

---

## Testing

### Vitest (mocked)

- `src/utils/budgetHealth.test.ts` — all four states + boundary cases (exactly 90%, projected 0 with actual > 0, both 0).
- `src/components/CategoryBudgetBar.test.tsx` — renders correct fill width, color class, and `aria-label` for each state.
- `src/api/budget.test.ts` — `deleteMonth` issues the `delete_month` RPC with `{ target_month }` and throws on error.
- `src/components/Header.test.tsx` — `🗑 Delete this month` button is visible when `canDelete` is true, hidden for the current/past month; `onDelete` fires on click.

### Playwright E2E (real QA backend, under `e2e/`)

- `e2e/specs/delete-month.spec.ts` — roll over to a future month → click `🗑 Delete this month` → confirm → assert the month is gone (header returns to the prior month, future month no longer reachable). Self-cleaning: leaves baseline intact; the `auth.setup.ts` reseed is the backstop. Respects the shared-test-user `concurrency` serialization.
- `e2e/specs/budget-health.spec.ts` — load the budget and assert a seeded baseline category renders its budget bar with the expected state and `aria-label` (fill width / over-budget styling), asserting against the reseeded baseline so it's deterministic.

Both E2E specs follow the existing Page Object Model + fixtures patterns and the console-guard allowlist.

---

## Out of scope (YAGNI)

- No bulk "manage months" UI — delete is per-month from the header only.
- No soft-delete / undo — delete is permanent (confirm dialog is the safety net).
- No deleting the current or past months.
- No overall (grand-total) budget bar — category-level only.

---

## Files touched

**New:**
- `supabase/migrations/0016_delete_month_rpc.sql`
- `src/utils/budgetHealth.ts` + `src/utils/budgetHealth.test.ts`
- `src/components/CategoryBudgetBar.tsx` + `src/components/CategoryBudgetBar.test.tsx`
- `e2e/specs/delete-month.spec.ts`
- `e2e/specs/budget-health.spec.ts`

**Modified:**
- `src/api/budget.ts` (+ `budget.test.ts`) — `deleteMonth`
- `src/components/Header.tsx` (+ `Header.test.tsx`) — delete button + `canDelete`/`onDelete` props
- `src/App.tsx` — `canDelete` computation, `handleDelete`
- `src/components/CategoryTable.tsx` — mount `CategoryBudgetBar`
- `src/themes.css` — `--warning` token per theme
- `CLAUDE.md` — v1.7 entry, changelog
- `src/changelog.ts` — v1.7 entry
