import { test, expect } from '../fixtures/test';
import { DashboardPage } from '../pages/DashboardPage';
import { AccountsPage } from '../pages/AccountsPage';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';
import { todayISO } from '../support/months';

// Accounts are global (not month-scoped) and the subtotals aggregate all of
// them, so these specs share one mutable pool and cannot run concurrently:
// parallel workers would wipe each other's rows mid-assertion.
test.describe.configure({ mode: 'serial' });

test.describe('accounts', () => {
  // The baseline reseed runs once in the setup project, not per test, so
  // UI-created accounts would otherwise accumulate across the specs in this
  // file and make every subtotal assertion depend on execution order.
  test.beforeEach(async () => {
    const uid = await getTestUserId(env.E2E_USER_EMAIL);
    await admin.from('accounts').delete().eq('user_id', uid);
    await admin.from('exchange_rates').delete().eq('user_id', uid);
  });

  test('@smoke creates accounts in two currencies and subtotals them', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto(); // also dismisses the changelog modal

    const accounts = new AccountsPage(page);
    await accounts.goto();

    await accounts.add('E2E Checking');
    await accounts.setBalance('E2E Checking', '1000');

    await accounts.add('E2E Euros');
    await accounts.setCurrency('E2E Euros', 'EUR');
    await accounts.setBalance('E2E Euros', '500');

    await expect(accounts.subtotal('USD')).toContainText('1,000.00');
    await expect(accounts.subtotal('EUR')).toContainText('500.00');
  });

  test('a manual rate produces a converted grand total', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const accounts = new AccountsPage(page);
    await accounts.goto();

    await accounts.add('E2E Bolivares');
    await accounts.setCurrency('E2E Bolivares', 'VES');
    await accounts.setBalance('E2E Bolivares', '74663');

    await accounts.saveRate('VES', todayISO(), '746.63');

    // 74,663 Bs at 746.63 Bs/$ = $100.00
    await expect(accounts.grandTotal).toContainText('100.00');
  });

  test('a negative balance reduces its subtotal', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const accounts = new AccountsPage(page);
    await accounts.goto();

    await accounts.add('E2E Cash');
    await accounts.setBalance('E2E Cash', '1000');
    await accounts.add('E2E Card');
    await accounts.setBalance('E2E Card', '-450');

    await expect(accounts.subtotal('USD')).toContainText('550.00');
  });

  test('deletes an account', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const accounts = new AccountsPage(page);
    await accounts.goto();

    await accounts.add('E2E Temp');
    await accounts.remove('E2E Temp');
    await expect(page.getByLabel('Name for E2E Temp')).toHaveCount(0);
  });
});
