import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';
import { MONTH_CURRENT } from '../data/baseline';
import { addMonths, monthLabel } from '../support/months';

// The month rollover creates. Derived from the seeded current month so it is
// always genuinely in the future — the app only renders the delete control for
// months strictly after today's.
const FUTURE_MONTH = addMonths(MONTH_CURRENT, 1);

test.describe('delete future month @regression', () => {
  test.afterEach(async () => {
    // Safety net: remove any rows left behind if the test failed mid-flow.
    const uid = await getTestUserId(env.E2E_USER_EMAIL);
    await admin.from('line_items').delete().eq('user_id', uid).eq('period_month', FUTURE_MONTH);
    await admin.from('income').delete().eq('user_id', uid).eq('period_month', FUTURE_MONTH);
  });

  test('rolls over to a future month, then deletes it and returns to the prior month', async ({
    dashboardPage,
  }) => {
    // Auto-accept both confirm() dialogs (rollover + delete).
    dashboardPage.page.on('dialog', (d) => d.accept());

    await dashboardPage.goto();
    // Loads on the latest month with data (the seeded current month).
    await expect(dashboardPage.header.monthLabel).toHaveText(monthLabel(MONTH_CURRENT));

    // Roll over to next month.
    await dashboardPage.header.startNextMonth.click();
    await expect(dashboardPage.header.monthLabel).toHaveText(monthLabel(FUTURE_MONTH));

    // The delete button is now visible (that month is in the future).
    await expect(dashboardPage.header.deleteMonthButton).toBeVisible();

    // Delete it and confirm we land back on the current month.
    await dashboardPage.header.deleteMonthButton.click();
    await expect(dashboardPage.header.monthLabel).toHaveText(monthLabel(MONTH_CURRENT));

    // The delete button is hidden on the current month (not deletable).
    await expect(dashboardPage.header.deleteMonthButton).toHaveCount(0);

    // Server-side: the future month has no rows.
    const uid = await getTestUserId(env.E2E_USER_EMAIL);
    const { data: items } = await admin
      .from('line_items')
      .select('id')
      .eq('user_id', uid)
      .eq('period_month', FUTURE_MONTH);
    expect(items ?? []).toHaveLength(0);
    const { data: income } = await admin
      .from('income')
      .select('period_month')
      .eq('user_id', uid)
      .eq('period_month', FUTURE_MONTH);
    expect(income ?? []).toHaveLength(0);
  });
});
