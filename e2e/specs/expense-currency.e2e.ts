import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';
import { MONTH_CURRENT } from '../data/baseline';
import { todayISO } from '../support/months';

/**
 * Uses scopedData so each test owns a uniquely-named category + item and cleans
 * up after itself, rather than mutating the shared baseline rows.
 *
 * Rates are seeded through the service role so the assertions do not depend on
 * whatever the live BCV rate happens to be today.
 */
async function seedVesRate(unitsPerUsd: number, rateDate: string): Promise<void> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);
  const { error } = await admin.from('exchange_rates').upsert(
    {
      user_id: uid,
      currency: 'VES',
      rate_date: rateDate,
      units_per_usd: unitsPerUsd,
      source: 'manual',
    },
    { onConflict: 'user_id,currency,rate_date' },
  );
  if (error) throw error;
}

test.describe('per-expense currency @regression', () => {
  test('converts a bolivar expense at the official rate, then at an override', async ({
    dashboardPage,
    scopedData,
  }) => {
    // 750 Bs to the dollar today.
    await seedVesRate(750, todayISO());

    const { itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 30000,
      actual: 30000,
    });

    await dashboardPage.goto();

    const row = dashboardPage.page.getByTestId(`line-item-${itemId}`);
    await row.getByLabel('Currency').selectOption('VES');

    // 30,000 Bs at 750 Bs/$ = $40.00
    await expect(dashboardPage.page.getByTestId(`converted-${itemId}`)).toContainText('40.00');

    // The user actually changed money at 800, not the official 750.
    const rateInput = row.getByLabel('Rate override');
    await rateInput.fill('800');
    await rateInput.blur();

    // 30,000 Bs at 800 Bs/$ = $37.50
    await expect(dashboardPage.page.getByTestId(`converted-${itemId}`)).toContainText('37.50');
    await expect(dashboardPage.page.getByTestId(`rate-overridden-${itemId}`)).toBeVisible();
  });

  test('clearing the currency returns the row to a plain amount', async ({
    dashboardPage,
    scopedData,
  }) => {
    await seedVesRate(750, todayISO());

    const { itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 1500,
      actual: 1500,
    });

    await dashboardPage.goto();

    const row = dashboardPage.page.getByTestId(`line-item-${itemId}`);
    await row.getByLabel('Currency').selectOption('VES');
    await expect(dashboardPage.page.getByTestId(`converted-${itemId}`)).toBeVisible();

    await row.getByLabel('Currency').selectOption('');
    await expect(dashboardPage.page.getByTestId(`converted-${itemId}`)).toHaveCount(0);
  });

  test('a currency with no rate for the date is flagged rather than silently mis-totalled', async ({
    dashboardPage,
    scopedData,
  }) => {
    const { itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 30000,
      actual: 30000,
    });

    // Backdate it to 2020. Rate lookup only ever carries FORWARD from an earlier
    // row, so no rate can resolve for that date — and this needs no global rate
    // deletion, which would race with the other specs in this file.
    const uid = await getTestUserId(env.E2E_USER_EMAIL);
    const { error } = await admin
      .from('line_items')
      .update({ paid_on: '2020-01-01' })
      .eq('user_id', uid)
      .eq('id', itemId);
    if (error) throw error;

    await dashboardPage.goto();
    const row = dashboardPage.page.getByTestId(`line-item-${itemId}`);
    await row.getByLabel('Currency').selectOption('VES');

    // The conversion cannot be done, so the app must say so rather than quietly
    // counting 30,000 as dollars. This shows immediately, without a reload.
    await expect(dashboardPage.page.getByTestId(`rate-unresolved-${itemId}`)).toBeVisible();
    await expect(dashboardPage.page.getByTestId('unresolved-rates')).toBeVisible();

    // The currency is saved optimistically, so wait for the write to actually
    // land before reloading — otherwise we race the PATCH and reload the old row.
    await expect.poll(async () => {
      const { data } = await admin
        .from('line_items').select('currency').eq('id', itemId).single();
      return data?.currency ?? null;
    }, { timeout: 10_000 }).toBe('VES');

    // ...and survives a reload, i.e. the currency really is persisted.
    await dashboardPage.goto();
    await expect(dashboardPage.page.getByTestId('unresolved-rates')).toBeVisible();
    await expect(dashboardPage.page.getByTestId(`rate-unresolved-${itemId}`)).toBeVisible();
  });
});
