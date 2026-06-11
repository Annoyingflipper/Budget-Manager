import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';

const FUTURE_MONTH = '2026-07-01'; // strictly after MONTH_CURRENT (2026-06-01)

test.describe('delete future month @regression', () => {
  test.afterEach(async () => {
    // Safety net: remove any July rows left behind if the test failed mid-flow.
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
    // Loads on the latest month (June 2026); the rollover button is shown.
    await expect(dashboardPage.header.monthLabel).toHaveText('June 2026');

    // Roll over to July 2026.
    await dashboardPage.header.startNextMonth.click();
    await expect(dashboardPage.header.monthLabel).toHaveText('July 2026');

    // The delete button is now visible (July is a future month).
    await expect(dashboardPage.header.deleteMonthButton).toBeVisible();

    // Delete July and confirm we land back on June.
    await dashboardPage.header.deleteMonthButton.click();
    await expect(dashboardPage.header.monthLabel).toHaveText('June 2026');

    // The delete button is hidden on June (current month, not deletable).
    await expect(dashboardPage.header.deleteMonthButton).toHaveCount(0);

    // Server-side: July has no rows.
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
