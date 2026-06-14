# Paid Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user record when each line item was paid (one optional date per item), show paid/unpaid state on every row, and surface a "still to pay" summary for the selected month.

**Architecture:** One additive nullable column `line_items.paid_on` (NULL = unpaid). A camelCase `LineItem.paidOn` flows through the existing `getBudget`/`updateLineItem` API. `LineItemRow` gains a "Mark paid" / editable-date control following the file's existing optimistic-update-with-rollback pattern. A pure `stillToPay` util feeds a small `StillToPay` component mounted on the dashboard. No auth, RLS, theme, rollover, or insights changes.

**Tech Stack:** React 19 + TypeScript 6 + Tailwind 4 + Supabase (Postgres) + Vitest 4 / React Testing Library 16 + Playwright.

**Reference spec:** `docs/superpowers/specs/2026-06-13-paid-dates-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/0017_line_item_paid_on.sql` — the new column.
- `src/utils/date.ts` — `todayISO()` local-clock date helper.
- `src/utils/date.test.ts` — its tests.
- `src/utils/stillToPay.ts` — pure "still to pay" computation.
- `src/utils/stillToPay.test.ts` — its tests.
- `src/components/StillToPay.tsx` — dashboard summary component.
- `src/components/StillToPay.test.tsx` — its tests.
- `e2e/specs/paid-dates.e2e.ts` — Playwright spec.

**Modify:**
- `src/types.ts` — add `paidOn` to `LineItem`.
- `src/api/budget.ts` — select/normalize/insert/update `paid_on`.
- `src/api/budget.test.ts` — assert select includes `paid_on`; test `updateLineItem` mapping.
- `src/components/LineItemRow.tsx` — paid control (desktop + mobile) + grid column.
- `src/components/LineItemRow.test.tsx` — paid-control tests + fixture `paidOn`.
- `src/components/CategoryTable.tsx` — header grid gains a "Paid" column.
- `src/App.tsx` — mount `<StillToPay>`.
- Test fixtures needing `paidOn: null`: `src/components/GrandTotals.test.tsx`, `src/components/CategoryTable.test.tsx`, `src/components/ExportButtons.test.tsx`, `src/utils/insights.test.ts`, `src/pages/Insights.test.tsx`.
- `e2e/components/LineItemRowComponent.ts` — paid locators/actions.
- `e2e/pages/DashboardPage.ts` — `stillToPay` locator.
- `src/changelog.ts` + `CLAUDE.md` — v1.8 entry.

---

## Task 1: Database migration — `paid_on` column

**Files:**
- Create: `supabase/migrations/0017_line_item_paid_on.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0017_line_item_paid_on.sql
-- v1.8: record when each line item was paid. NULL = unpaid.
-- Nullable, no default → all existing and new items start unpaid (no backfill).
-- No date constraint: a bill for one month may be paid in an adjacent month.
-- Existing line_items RLS select/update policies already cover all columns
-- (and enforce AAL2), so the new column inherits them — no policy change.
alter table public.line_items add column paid_on date;
```

- [ ] **Step 2: Apply the migration to the QA Supabase project**

Apply against QA project ref `ovnkgwnlquislfdwaifh` (local dev shares this DB). Use the Supabase MCP `apply_migration` tool with name `0017_line_item_paid_on` and the SQL above, OR run it in the QA SQL editor. (PRD project `vouazcrsrdnaeivffwot` gets the same migration applied at release time, before merging to `main`.)

- [ ] **Step 3: Verify the column exists**

Run (MCP `execute_sql` or SQL editor against QA):
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'line_items' and column_name = 'paid_on';
```
Expected: one row — `paid_on | date | YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0017_line_item_paid_on.sql
git commit -m "feat(db): add line_items.paid_on column (v1.8)"
```

---

## Task 2: `todayISO()` date util

A local-clock `YYYY-MM-DD` string (avoids the UTC off-by-one of `new Date().toISOString()` near midnight).

**Files:**
- Create: `src/utils/date.ts`
- Test: `src/utils/date.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/date.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayISO } from './date';

afterEach(() => { vi.useRealTimers(); });

describe('todayISO', () => {
  it('returns the local date as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 9, 30)); // local June 13 2026 09:30
    expect(todayISO()).toBe('2026-06-13');
  });

  it('zero-pads month and day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 23, 59)); // local Jan 5 2026
    expect(todayISO()).toBe('2026-01-05');
  });

  it('always matches the YYYY-MM-DD shape', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/date.test.ts`
Expected: FAIL — cannot find module `./date` / `todayISO` is not a function.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/date.ts
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Today's date in the local timezone as `YYYY-MM-DD`. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/date.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/date.ts src/utils/date.test.ts
git commit -m "feat(utils): add todayISO local-date helper"
```

---

## Task 3: `stillToPay` util

Counts unpaid line items (`paidOn === null`) and sums their **projected** amounts across all categories.

**Files:**
- Create: `src/utils/stillToPay.ts`
- Test: `src/utils/stillToPay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/stillToPay.test.ts
import { describe, it, expect } from 'vitest';
import { stillToPay } from './stillToPay';
import type { CategoryWithItems } from '../types';

function cat(
  id: number,
  items: Array<{ projected: number; paidOn: string | null }>,
): CategoryWithItems {
  return {
    id,
    name: `Cat${id}`,
    display_order: id,
    icon: '',
    items: items.map((i, idx) => ({
      id: id * 100 + idx,
      category_id: id,
      name: `Item${idx}`,
      projected: i.projected,
      actual: 0,
      paidOn: i.paidOn,
    })),
  };
}

describe('stillToPay', () => {
  it('returns zeroes for no categories', () => {
    expect(stillToPay([])).toEqual({ count: 0, amount: 0 });
  });

  it('returns zeroes when every item is paid', () => {
    const cats = [cat(1, [{ projected: 50, paidOn: '2026-06-02' }])];
    expect(stillToPay(cats)).toEqual({ count: 0, amount: 0 });
  });

  it('counts and sums projected for unpaid items only', () => {
    const cats = [
      cat(1, [
        { projected: 100, paidOn: null },        // unpaid
        { projected: 50, paidOn: '2026-06-01' }, // paid → excluded
      ]),
      cat(2, [
        { projected: 20.5, paidOn: null },       // unpaid
      ]),
    ];
    expect(stillToPay(cats)).toEqual({ count: 2, amount: 120.5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/stillToPay.test.ts`
Expected: FAIL — cannot find module `./stillToPay`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/stillToPay.ts
import { sum } from './money';
import type { CategoryWithItems } from '../types';

export type StillToPay = { count: number; amount: number };

/** Outstanding (unpaid) line items across all categories for one month. */
export function stillToPay(categories: CategoryWithItems[]): StillToPay {
  const unpaid = categories.flatMap((c) => c.items).filter((i) => i.paidOn === null);
  return { count: unpaid.length, amount: sum(unpaid.map((i) => i.projected)) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/stillToPay.test.ts`
Expected: PASS (3 tests).

> Note: this imports `LineItem.paidOn`, which is added in Task 4. If you run the full typecheck before Task 4, expect a type error on `i.paidOn`; the isolated test above still passes because the fixture supplies `paidOn`. Land Task 4 to make the whole project typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/utils/stillToPay.ts src/utils/stillToPay.test.ts
git commit -m "feat(utils): add stillToPay (unpaid count + projected sum)"
```

---

## Task 4: Types + API + fixtures (keep the whole suite green)

Add `paidOn` to the `LineItem` type and thread `paid_on` through `getBudget`, `addLineItem`, and `updateLineItem`. Because `LineItem` gains a required field, every `LineItem` object literal in the codebase must add `paidOn`. This task ends with `npm run typecheck` and `npm test` fully green.

**Files:**
- Modify: `src/types.ts:8-14`, `src/api/budget.ts` (lines ~30, 38-44, 117-143, 145-151), `src/api/budget.test.ts`
- Modify fixtures: `src/components/GrandTotals.test.tsx`, `src/components/CategoryTable.test.tsx`, `src/components/ExportButtons.test.tsx`, `src/utils/insights.test.ts`, `src/pages/Insights.test.tsx`, `src/components/LineItemRow.test.tsx`

- [ ] **Step 1: Write the failing API tests first**

In `src/api/budget.test.ts`, (a) add `'update'` to the builder's `methods` array so `update()` is recorded:

```ts
// src/api/budget.test.ts — change line ~9
const methods = ['select', 'eq', 'order', 'single', 'maybeSingle', 'update'];
```

(b) Import `updateLineItem` in the existing import on line ~33:

```ts
import { getBudget, listMonths, rolloverMonth, getExportRows, deleteMonth, updateLineItem } from './budget';
```

(c) Add these tests inside the top-level `describe`:

```ts
it('getBudget selects paid_on for line_items', async () => {
  fromMock.mockImplementation((table: string) => {
    if (table === 'line_items') return builder([]);
    return builder(null);
  });
  await getBudget('2026-06-01');
  const lineItemSelect = calls.find(
    (c) => c.kind === 'select' && String(c.args[0]).includes('category_id'),
  );
  expect(String(lineItemSelect?.args[0])).toContain('paid_on');
});

it('updateLineItem maps paidOn to paid_on and passes other fields through', async () => {
  fromMock.mockReturnValue(builder(null));
  await updateLineItem(42, { paidOn: '2026-06-13', projected: 20 });
  const update = calls.find((c) => c.kind === 'update');
  expect(update?.args[0]).toEqual({ paid_on: '2026-06-13', projected: 20 });
});

it('updateLineItem maps a null paidOn (un-pay) to paid_on: null', async () => {
  fromMock.mockReturnValue(builder(null));
  await updateLineItem(7, { paidOn: null });
  const update = calls.find((c) => c.kind === 'update');
  expect(update?.args[0]).toEqual({ paid_on: null });
});
```

- [ ] **Step 2: Run the new API tests to verify they fail**

Run: `npm test -- src/api/budget.test.ts`
Expected: FAIL — `updateLineItem` sends `{ paidOn: ... }` (no mapping) and the select doesn't include `paid_on` yet.

- [ ] **Step 3: Add `paidOn` to the `LineItem` type**

```ts
// src/types.ts (replace lines 8-14)
export type LineItem = {
  id: number;
  category_id: number;
  name: string;
  projected: number;
  actual: number;
  paidOn: string | null; // ISO 'YYYY-MM-DD', or null when unpaid
};
```

- [ ] **Step 4: Thread `paid_on` through `src/api/budget.ts`**

(a) `getBudget` line_items select (line ~30) — add `paid_on`:
```ts
    .select('id, category_id, name, projected, actual, paid_on')
```

(b) `getBudget` normalization (lines ~38-44) — add `paidOn`:
```ts
    const normalized: LineItem = {
      id: raw.id,
      category_id: raw.category_id,
      name: raw.name,
      projected: Number(raw.projected),
      actual: Number(raw.actual),
      paidOn: raw.paid_on ?? null,
    };
```

(c) `addLineItem` (lines ~133-142) — select `paid_on` and return `paidOn`:
```ts
    .select('id, category_id, name, projected, actual, paid_on')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category_id: data.category_id,
    name: data.name,
    projected: Number(data.projected),
    actual: Number(data.actual),
    paidOn: data.paid_on ?? null,
  };
```
(New items are inserted without `paid_on`, so it comes back `null`. Do **not** add `paid_on` to the `.insert({...})` object.)

(d) `updateLineItem` (lines 145-151) — accept `paidOn` and map it to `paid_on`:
```ts
export async function updateLineItem(
  id: number,
  patch: Partial<{ name: string; projected: number; actual: number; paidOn: string | null }>,
): Promise<void> {
  const { paidOn, ...rest } = patch;
  const dbPatch: Record<string, unknown> = { ...rest };
  if ('paidOn' in patch) dbPatch.paid_on = paidOn;
  const { error } = await supabase.from('line_items').update(dbPatch).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 5: Add `paidOn: null` to every other `LineItem` literal**

These fixtures build `LineItem`/`CategoryWithItems` objects and will fail to typecheck until each line-item literal includes `paidOn`. Add `paidOn: null` to each:

- `src/components/GrandTotals.test.tsx` — in the `category()` helper's `items.map((i) => ({ ... }))`, add `paidOn: null`.
- `src/components/CategoryTable.test.tsx` — every line-item literal.
- `src/components/ExportButtons.test.tsx` — every line-item literal.
- `src/utils/insights.test.ts` — every line-item literal.
- `src/pages/Insights.test.tsx` — every line-item literal.
- `src/components/LineItemRow.test.tsx` — the `baseItem` fixture (lines 10-16): add `paidOn: null`.

Find them all with:
```bash
grep -rln "category_id:" src | grep -i test
```
For each file, every object that has `category_id`/`projected`/`actual` and is typed as a `LineItem` needs `paidOn: null`. (`src/types.ts` and `src/api/budget.ts` are already handled above — skip them.)

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests PASS (including the 3 new API tests).

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/api/budget.ts src/api/budget.test.ts \
  src/components/GrandTotals.test.tsx src/components/CategoryTable.test.tsx \
  src/components/ExportButtons.test.tsx src/utils/insights.test.ts \
  src/pages/Insights.test.tsx src/components/LineItemRow.test.tsx
git commit -m "feat(api): thread paidOn through LineItem type and budget API"
```

---

## Task 5: `LineItemRow` paid control

Add the "Mark paid" / editable-date control. Unpaid → a "Mark paid" button stamps today. Paid → a `✓`, an editable date input, and a clear (`✕`) button that un-pays. Uses the same optimistic-update-with-rollback shape as `saveProjected`.

**Files:**
- Modify: `src/components/LineItemRow.tsx`
- Test: `src/components/LineItemRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/LineItemRow.test.tsx` (the `baseItem` already has `paidOn: null` from Task 4). Add a paid fixture and tests:

```ts
const paidItem: LineItem = { ...baseItem, paidOn: '2026-06-10' };

it('Mark paid stamps today and calls updateLineItem with paidOn', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 5, 13, 9, 0)); // local June 13 2026
  const user = userEvent.setup();
  vi.mocked(api.updateLineItem).mockResolvedValue();
  const { onChange } = renderRow();
  await user.click(screen.getByRole('button', { name: 'Mark paid' }));
  await waitFor(() => {
    expect(api.updateLineItem).toHaveBeenCalledWith(42, { paidOn: '2026-06-13' });
  });
  expect(onChange).toHaveBeenCalledWith({ ...baseItem, paidOn: '2026-06-13' });
  vi.useRealTimers();
});

it('reverts paid state when the mark-paid update fails', async () => {
  const user = userEvent.setup();
  vi.mocked(api.updateLineItem).mockRejectedValue(new Error('network'));
  const { onChange } = renderRow();
  await user.click(screen.getByRole('button', { name: 'Mark paid' }));
  await waitFor(() => {
    expect(onChange).toHaveBeenLastCalledWith(baseItem);
  });
});

it('clearing the date un-pays the item (paidOn: null)', async () => {
  const user = userEvent.setup();
  vi.mocked(api.updateLineItem).mockResolvedValue();
  const { onChange } = renderRow({ item: paidItem });
  await user.click(screen.getByRole('button', { name: 'Clear paid date' }));
  await waitFor(() => {
    expect(api.updateLineItem).toHaveBeenCalledWith(42, { paidOn: null });
  });
  expect(onChange).toHaveBeenCalledWith({ ...paidItem, paidOn: null });
});

it('editing the date saves the new paidOn', async () => {
  const user = userEvent.setup();
  vi.mocked(api.updateLineItem).mockResolvedValue();
  renderRow({ item: paidItem });
  const dateInput = screen.getByLabelText('Paid date');
  await user.clear(dateInput);
  await user.type(dateInput, '2026-06-20');
  await user.tab();
  await waitFor(() => {
    expect(api.updateLineItem).toHaveBeenCalledWith(42, { paidOn: '2026-06-20' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/LineItemRow.test.tsx`
Expected: FAIL — no "Mark paid" / "Paid date" / "Clear paid date" controls exist yet.

- [ ] **Step 3: Implement the paid control in `LineItemRow.tsx`**

(a) Add the import at the top:
```ts
import { todayISO } from '../utils/date';
```

(b) Add a save handler alongside `saveActual` (after line 60). It handles mark-paid, edit, and clear with one helper:
```ts
  async function savePaidOn(next: string | null) {
    if (next === item.paidOn) return;
    const previous = item;
    onChange({ ...item, paidOn: next });
    try { await updateLineItem(item.id, { paidOn: next }); }
    catch { onChange(previous); }
  }
```

(c) Build the paid control element (place after `actualInput`, before the mobile branch):
```tsx
  const paidControl = item.paidOn ? (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-positive text-sm shrink-0" aria-hidden="true">✓</span>
      <input
        type="date"
        aria-label="Paid date"
        value={item.paidOn}
        onChange={(e) => savePaidOn(e.target.value || null)}
        className="w-full min-w-0 px-1 py-1 border border-highlight rounded-md bg-card text-xs"
      />
      <button
        type="button"
        onClick={() => savePaidOn(null)}
        aria-label="Clear paid date"
        className="shrink-0 text-muted hover:text-negative text-sm"
      >
        ✕
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => savePaidOn(todayISO())}
      aria-label="Mark paid"
      className="w-full px-2 py-1 border border-highlight rounded-md bg-bg text-muted text-xs hover:text-positive"
    >
      Mark paid
    </button>
  );
```

(d) Desktop layout (lines 148-162) — add a Paid column to the grid (between Diff and the delete column) and render `paidControl`:
```tsx
  return (
    <div
      className="grid items-center gap-1.5"
      style={{ gridTemplateColumns: '1.4fr 80px 80px 80px 110px 24px' }}
      data-testid={`line-item-${item.id}`}
    >
      {nameInput}
      {projectedInput}
      {actualInput}
      <div className={`text-right pr-1 text-sm font-bold ${diffClass}`}>
        {formatMoney(diff)}
      </div>
      {paidControl}
      <div className="text-center">{deleteButton}</div>
    </div>
  );
```

(e) Mobile layout (lines 121-145) — add a "Paid" block under the 3-col grid, inside the outer flex container:
```tsx
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 p-2 bg-bg rounded-lg">
        <div className="flex items-center gap-2">
          {nameInput}
          <div className="shrink-0">{deleteButton}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Projected</div>
            {projectedInput}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Actual</div>
            {actualInput}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Diff</div>
            <div className={`px-2 py-1 text-right text-sm font-bold ${diffClass}`}>
              {formatMoney(diff)}
            </div>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Paid</div>
          {paidControl}
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/LineItemRow.test.tsx`
Expected: PASS (existing tests + 4 new paid-control tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LineItemRow.tsx src/components/LineItemRow.test.tsx
git commit -m "feat(ui): mark-paid / editable paid date on LineItemRow"
```

---

## Task 6: `CategoryTable` header — add the "Paid" column

Keep the desktop header grid aligned with the row grid changed in Task 5.

**Files:**
- Modify: `src/components/CategoryTable.tsx:74-83`

- [ ] **Step 1: Update the header grid template + add the Paid header**

Replace the header block (lines 74-83):
```tsx
      <div
        className="hidden sm:grid gap-1.5 items-center mb-1"
        style={{ gridTemplateColumns: '1.4fr 80px 80px 80px 110px 24px' }}
      >
        <div className="text-muted text-xs uppercase tracking-wider">Name</div>
        <div className="text-muted text-xs uppercase tracking-wider text-right">Proj</div>
        <div className="text-muted text-xs uppercase tracking-wider text-right">Actual</div>
        <div className="text-muted text-xs uppercase tracking-wider text-right">Diff</div>
        <div className="text-muted text-xs uppercase tracking-wider">Paid</div>
        <div />
      </div>
```

- [ ] **Step 2: Run the existing CategoryTable tests**

Run: `npm test -- src/components/CategoryTable.test.tsx`
Expected: PASS (no behavior change; header is presentational).

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryTable.tsx
git commit -m "feat(ui): add Paid column header to CategoryTable"
```

---

## Task 7: `StillToPay` component + dashboard mount

**Files:**
- Create: `src/components/StillToPay.tsx`
- Test: `src/components/StillToPay.test.tsx`
- Modify: `src/App.tsx:179-183` (mount under `IncomeSummary`)

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/StillToPay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StillToPay from './StillToPay';
import type { CategoryWithItems } from '../types';

function cat(items: Array<{ projected: number; paidOn: string | null }>): CategoryWithItems {
  return {
    id: 1, name: 'Cat', display_order: 1, icon: '',
    items: items.map((i, idx) => ({
      id: idx, category_id: 1, name: `Item${idx}`,
      projected: i.projected, actual: 0, paidOn: i.paidOn,
    })),
  };
}

describe('StillToPay', () => {
  it('shows count + amount when items are unpaid', () => {
    render(<StillToPay categories={[cat([
      { projected: 100, paidOn: null },
      { projected: 20, paidOn: null },
      { projected: 5, paidOn: '2026-06-01' },
    ])]} />);
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('2 bills left');
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('$120.00');
  });

  it('shows the singular form for one unpaid bill', () => {
    render(<StillToPay categories={[cat([{ projected: 100, paidOn: null }])]} />);
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('1 bill left');
  });

  it('shows the all-paid state when nothing is outstanding', () => {
    render(<StillToPay categories={[cat([{ projected: 100, paidOn: '2026-06-02' }])]} />);
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('All paid this month');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/StillToPay.test.tsx`
Expected: FAIL — cannot find module `./StillToPay`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/StillToPay.tsx
import { stillToPay } from '../utils/stillToPay';
import { formatMoney } from '../utils/money';
import type { CategoryWithItems } from '../types';

type Props = { categories: CategoryWithItems[] };

export default function StillToPay({ categories }: Props) {
  const { count, amount } = stillToPay(categories);

  if (count === 0) {
    return (
      <section
        data-testid="still-to-pay"
        className="bg-card rounded-xl px-4 py-2.5 mb-3 text-sm text-positive font-bold"
      >
        ✓ All paid this month
      </section>
    );
  }

  return (
    <section
      data-testid="still-to-pay"
      className="bg-card rounded-xl px-4 py-2.5 mb-3 flex justify-between items-center text-sm"
    >
      <span className="font-bold">
        {count} {count === 1 ? 'bill' : 'bills'} left
      </span>
      <span className="text-muted">{formatMoney(amount)} still to pay</span>
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/StillToPay.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount it in `App.tsx`**

Add the import near the other component imports (after line 8):
```ts
import StillToPay from './components/StillToPay';
```
Render it right after the `<IncomeSummary>` block closes (after line 183, before the categories `.map`):
```tsx
          <StillToPay categories={budget.categories} />
```

- [ ] **Step 6: Verify typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/StillToPay.tsx src/components/StillToPay.test.tsx src/App.tsx
git commit -m "feat(ui): StillToPay dashboard summary"
```

---

## Task 8: E2E — Page Objects + spec

**Files:**
- Modify: `e2e/components/LineItemRowComponent.ts`
- Modify: `e2e/pages/DashboardPage.ts`
- Create: `e2e/specs/paid-dates.e2e.ts`

- [ ] **Step 1: Add paid locators/actions to `LineItemRowComponent.ts`**

Add these getters/methods to the class:
```ts
  get markPaidButton(): Locator { return this.root.getByRole('button', { name: 'Mark paid' }); }
  get paidDateInput(): Locator { return this.root.getByLabel('Paid date'); }
  get clearPaidButton(): Locator { return this.root.getByRole('button', { name: 'Clear paid date' }); }

  async markPaid(): Promise<void> {
    await this.markPaidButton.click();
  }
  async clearPaid(): Promise<void> {
    await this.clearPaidButton.click();
  }
```

- [ ] **Step 2: Add a `stillToPay` locator to `DashboardPage.ts`**

Add a getter on the `DashboardPage` class (follow the file's existing locator style):
```ts
  get stillToPay(): Locator { return this.page.getByTestId('still-to-pay'); }
```
(Ensure `Locator` is imported in that file; it already imports Playwright types — match the existing import.)

- [ ] **Step 3: Write the spec**

The auth `setup` reseeds baseline before the run; baseline line items all start unpaid (`paid_on` defaults NULL). `DashboardPage` already exposes a `lineItem(itemId): LineItemRowComponent` factory (and already imports `LineItemRowComponent`), so no page-object plumbing is needed. This spec resolves the first line item in the **Services** category from the seed, then drives its row.

```ts
// e2e/specs/paid-dates.e2e.ts
import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';

async function firstServicesItemId(): Promise<number> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);
  const { data: cat } = await admin
    .from('categories').select('id').eq('user_id', uid).eq('name', 'Services').single();
  const { data: item, error } = await admin
    .from('line_items')
    .select('id')
    .eq('user_id', uid)
    .eq('category_id', cat!.id)
    .eq('period_month', '2026-06-01')
    .order('created_at')
    .limit(1)
    .single();
  if (error) throw error;
  return item!.id as number;
}

test.describe('paid dates @regression', () => {
  test('mark a bill paid then un-pay it, summary updates', async ({ dashboardPage, page }) => {
    const itemId = await firstServicesItemId();
    await dashboardPage.goto();
    await expect(dashboardPage.header.monthLabel).toHaveText('June 2026');

    const row = dashboardPage.lineItem(itemId);

    // Baseline: item is unpaid → "Mark paid" visible, summary shows outstanding bills.
    await expect(row.markPaidButton).toBeVisible();
    await expect(dashboardPage.stillToPay).toContainText('bills left');

    // Mark paid → date input appears with today's date persisted.
    await row.markPaid();
    await expect(row.paidDateInput).toBeVisible();
    await expect(row.markPaidButton).toHaveCount(0);

    // Reload → paid state persisted in the DB.
    await page.reload();
    await expect(dashboardPage.lineItem(itemId).paidDateInput).toBeVisible();

    // Un-pay → "Mark paid" returns.
    await dashboardPage.lineItem(itemId).clearPaid();
    await expect(dashboardPage.lineItem(itemId).markPaidButton).toBeVisible();
  });
});
```

> Uses the existing `DashboardPage.lineItem(id)` factory. The `ChangelogModal` only auto-shows once per version bump and is dismissed by `goto()`, so the post-reload state won't re-show it — no extra dismissal needed.

- [ ] **Step 4: Typecheck the E2E project**

Run: `npm run e2e:typecheck`
Expected: no type errors.

- [ ] **Step 5: Run the spec against QA**

Run: `npm run e2e -- paid-dates`
Expected: PASS. (Requires the Task 1 migration applied to QA and `.env.e2e.local` configured.)

- [ ] **Step 6: Commit**

```bash
git add e2e/components/LineItemRowComponent.ts e2e/pages/DashboardPage.ts e2e/specs/paid-dates.e2e.ts
git commit -m "test(e2e): paid-dates spec + page-object locators"
```

---

## Task 9: Changelog + docs

**Files:**
- Modify: `src/changelog.ts`
- Modify: `CLAUDE.md` (Shipped versions section)

- [ ] **Step 1: Add the v1.8 changelog entry**

Open `src/changelog.ts` and **prepend** a new entry to the `CHANGELOG` array with `version: '1.8'`. `LATEST_VERSION` is auto-derived (`CHANGELOG[0].version`), so prepending is all that's needed — do not add a separate assignment. Match the existing entry shape exactly; content:
> **v1.8 — Paid dates.** Record when each bill is paid: a "Mark paid" button stamps today on any line item, with an editable date you can change or clear to un-pay. Unpaid vs. paid is visible at a glance, and a new "still to pay" summary shows how many bills and how much is left this month.

- [ ] **Step 2: Run the changelog test (if any) + full suite**

Run: `npm test`
Expected: green. (If a `ChangelogModal`/changelog test asserts the latest version, update it to `1.8`.)

- [ ] **Step 3: Add the v1.8 entry to `CLAUDE.md`**

Under "Shipped versions", append:
> - **v1.8** (2026-06-13): Paid dates. `paid_on date` nullable column on `line_items` (`supabase/migrations/0017_line_item_paid_on.sql`, no constraint, NULL = unpaid). `LineItem.paidOn` threaded through `getBudget`/`addLineItem`/`updateLineItem` (camelCase ↔ `paid_on`). `LineItemRow` "Mark paid"/editable-date/clear control (`todayISO()` in `src/utils/date.ts`). `stillToPay` util + `StillToPay` summary mounted under `IncomeSummary`. New Vitest tests (date, stillToPay, StillToPay, row paid-control, API mapping) + `paid-dates.e2e.ts`.

Also update the "Next likely brainstorms" note if appropriate (paid-dates done; overdue highlight + CSV paid-date column are the natural follow-ups).

- [ ] **Step 4: Final full verification**

Run: `npm run typecheck && npm test && npm run build && npm run e2e:typecheck`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/changelog.ts CLAUDE.md
git commit -m "docs: v1.8 changelog + CLAUDE.md paid-dates entry"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), `paidOn` type/API + mapping (Task 4), row UI mark-paid/edit/clear (Task 5), unpaid/paid visual state (Tasks 5–6), `stillToPay` util + summary component + all-paid state (Tasks 3, 7), Vitest coverage (util/row/summary/API — Tasks 2–7), Playwright spec (Task 8). Out-of-scope items (overdue, CSV paid-date, installments) intentionally absent. ✓
- **Type consistency:** `LineItem.paidOn: string | null` used identically across types, API patch, util, components, and tests. `updateLineItem` accepts `{ paidOn }` and maps to `paid_on`. `stillToPay` returns `{ count, amount }` consistently. Grid template `'1.4fr 80px 80px 80px 110px 24px'` matches between `LineItemRow` (Task 5) and `CategoryTable` header (Task 6). ✓
- **No placeholders:** every code/edit step shows concrete content. The only conditional is the E2E page-object factory (Task 8 Step 3), with the exact fallback code provided. ✓
- **Ordering:** Task 3 imports `paidOn` (added in Task 4) — flagged inline; its isolated test passes regardless, and Task 4 makes the whole project typecheck.
