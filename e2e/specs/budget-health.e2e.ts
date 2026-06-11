import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';

async function categoryIdByName(name: string): Promise<number> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);
  const { data, error } = await admin
    .from('categories')
    .select('id')
    .eq('user_id', uid)
    .eq('name', name)
    .single();
  if (error) throw error;
  return data.id as number;
}

test.describe('budget-health bars @regression', () => {
  test('shows over state for an over-budget category and under for an under-budget one', async ({
    dashboardPage,
  }) => {
    const servicesId = await categoryIdByName('Services');
    const entertainmentId = await categoryIdByName('Entertainment');

    await dashboardPage.goto();
    await expect(dashboardPage.header.monthLabel).toHaveText('June 2026');

    const servicesBar = dashboardPage.categoryTable(servicesId).budgetBar;
    await expect(servicesBar).toHaveAttribute('data-state', 'over');
    await expect(servicesBar).toHaveAttribute('aria-label', 'Services budget: over by $5.00');

    const entBar = dashboardPage.categoryTable(entertainmentId).budgetBar;
    await expect(entBar).toHaveAttribute('data-state', 'under');
  });
});
