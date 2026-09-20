import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';
import { MONTH_CURRENT } from '../data/baseline';
import { addMonths, monthLabel } from '../support/months';

/**
 * Rollover lives in its own file so `playwright.config.ts` can run it in the
 * `chromium-month-mutating` project, which depends on `chromium` and therefore
 * starts only after every other spec has finished.
 *
 * It used to sit inside `due-dates.e2e.ts` as a `describe.serial` block, which
 * serialized it against the other due-date tests but NOT against other files —
 * and `fullyParallel` is on. So for the few seconds this test held a rolled-over
 * month open, the shared test user had line items in MONTH_CURRENT + 1, the app
 * opened on that month instead of the current one (it lands on the latest month
 * with data), and any spec on another worker that navigated or reloaded in that
 * window asserted against the wrong month.
 *
 * That produced a genuinely confusing failure mode: three consecutive full runs
 * each failed a DIFFERENT spec — receipts, expense-currency, paid-dates — and
 * every one passed when re-run alone. `paid-dates` named the mechanism out loud
 * ("expected September 2026, received October 2026") but only by luck of which
 * assertion happened to trip.
 *
 * `delete-month.e2e.ts` already had the right treatment for exactly this reason.
 * This file now gets it too. Do not move these tests back into a file that runs
 * in the parallel `chromium` project.
 */
test.describe.serial('rollover @regression', () => {
  /**
   * The regression test for the v1.4 rollover column list. Before 0021 the RPC
   * inserted a fixed set of columns, so currency and rate_units_per_usd (added
   * in v1.9) were silently dropped and foreign expenses came back as base
   * currency. Only a real round-trip through Postgres exercises that.
   */

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
