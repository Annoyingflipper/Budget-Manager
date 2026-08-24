import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';
import { MONTH_CURRENT } from '../data/baseline';
import { todayISO, addMonths, monthLabel } from '../support/months';

function shiftDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ComingUp aggregates due dates across the WHOLE current month for the shared
// test user, not just the fixture rows a given test created (see src/components/
// ComingUp.tsx). Under fullyParallel, two of these tests setting an overdue due
// date in the same real calendar month land in the same bucket totals and each
// other's item counts — the exact same "shared mutable pool" problem
// accounts.e2e.ts documents. Serialize the whole file, not just the rollover
// group, so no two due-date mutations in MONTH_CURRENT are ever in flight together.
test.describe.configure({ mode: 'serial' });

test.describe('due dates @regression', () => {
  test('buckets a bill by its due date and drops it once paid', async ({
    dashboardPage,
    scopedData,
  }) => {
    const { itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 310,
      actual: 0,
    });

    await dashboardPage.goto();
    const row = dashboardPage.lineItem(itemId);

    // Past due → overdue.
    await row.setDue(shiftDays(todayISO(), -3));
    await expect(dashboardPage.overdueBucket).toContainText('310.00');

    // Inside the week → due soon.
    await row.setDue(shiftDays(todayISO(), 2));
    await expect(dashboardPage.dueSoonBucket).toContainText('310.00');
    await expect(dashboardPage.overdueBucket).toBeHidden();

    // Paid bills are not due.
    await row.markPaid();
    await expect(dashboardPage.dueSoonBucket).toBeHidden();
  });

  test('expands a bucket to name the bill', async ({ dashboardPage, scopedData }) => {
    const { itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      itemName: 'Electric bill',
      projected: 75,
      actual: 0,
    });

    await dashboardPage.goto();
    await dashboardPage.lineItem(itemId).setDue(shiftDays(todayISO(), 1));
    await dashboardPage.dueSoonBucket.click();
    await expect(dashboardPage.comingUp).toContainText('Electric bill');
  });

  /**
   * The regression test for the v1.4 rollover column list. Before 0021 the RPC
   * inserted a fixed set of columns, so currency and rate_units_per_usd (added
   * in v1.9) were silently dropped and foreign expenses came back as base
   * currency. Only a real round-trip through Postgres exercises that.
   *
   * Serial because rollover creates a whole month for the shared test user.
   */
  test.describe.serial('rollover', () => {
    // Target month is deterministic (derived from MONTH_CURRENT), so both the
    // pre-test guard and this safety net can compute it without sharing state
    // with the test body.
    const target = addMonths(MONTH_CURRENT, 1);

    test.afterEach(async () => {
      // Safety net: remove any rows left behind if the test failed mid-flow —
      // in particular if the DB assertion below fails, which is exactly the
      // scenario this regression test exists to catch. Without this, the one
      // moment someone most needs clean QA state to investigate a real
      // rollover regression is the moment the test leaves it dirty. Mirrors
      // delete-month.e2e.ts's afterEach for the same reason.
      //
      // The income delete is the load-bearing half: ScopedData.cleanup()
      // (the scopedData fixture's own teardown) already removes the
      // rolled-over line_items via category_id — rollover reuses the same
      // category_id, so the fixture's per-category delete catches both the
      // source and target rows — but it never touches income, which rollover
      // writes as a separate row keyed by period_month with no category link.
      const uid = await getTestUserId(env.E2E_USER_EMAIL);
      await admin.from('line_items').delete().eq('user_id', uid).eq('period_month', target);
      await admin.from('income').delete().eq('user_id', uid).eq('period_month', target);
    });

    test('carries currency and due date into the new month', async ({
      dashboardPage,
      scopedData,
    }) => {
      const uid = await getTestUserId(env.E2E_USER_EMAIL);

      // Make sure the target month is empty — rollover refuses otherwise.
      await admin.from('line_items').delete().eq('user_id', uid).eq('period_month', target);
      await admin.from('income').delete().eq('user_id', uid).eq('period_month', target);

      const { itemId } = await scopedData.createCategoryWithItem({
        periodMonth: MONTH_CURRENT,
        itemName: 'Euro subscription',
        projected: 40,
        actual: 0,
      });

      await admin
        .from('line_items')
        .update({ currency: 'EUR', due_on: `${MONTH_CURRENT.slice(0, 8)}05` })
        .eq('id', itemId);

      await dashboardPage.goto();
      dashboardPage.page.once('dialog', (d) => d.accept());
      await dashboardPage.header.startNextMonth.click();

      // The click only waits for the DOM event to dispatch, not for the async
      // handleRollover() → rolloverMonth() RPC round-trip it kicks off. The app
      // only calls setSelectedMonth(target) once that awaited call resolves, so
      // waiting for the header to relabel is proof the RPC has actually returned
      // — without it, the DB assertion below races the network request.
      await expect(dashboardPage.header.monthLabel).toHaveText(monthLabel(target));

      // Assert against the database: the UI would also pass if the RPC dropped
      // the columns and the client happened to re-derive them.
      const { data } = await admin
        .from('line_items')
        .select('name, currency, due_on')
        .eq('user_id', uid)
        .eq('period_month', target)
        .eq('name', 'Euro subscription')
        .single();

      expect(data?.currency).toBe('EUR');
      expect(data?.due_on).toBe(`${target.slice(0, 8)}05`);
    });
  });
});
