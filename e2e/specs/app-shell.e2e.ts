import { test, expect } from '../fixtures/test';

test.describe('app shell @smoke', () => {
  test('desktop shows the sidebar and reaches every destination', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const nav = dashboardPage.page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();

    for (const label of ['Budget', 'Accounts', 'Insights', 'Settings']) {
      await expect(nav.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('marks the current destination', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const nav = dashboardPage.page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('button', { name: 'Budget' }))
      .toHaveAttribute('aria-current', 'page');

    await nav.getByRole('button', { name: 'Insights' }).click();
    await expect(nav.getByRole('button', { name: 'Insights' }))
      .toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('button', { name: 'Budget' }))
      .not.toHaveAttribute('aria-current', 'page');
  });

  test('mobile shows the tab bar instead of the sidebar', async ({ dashboardPage }) => {
    // 375x812 is the mobile preset; useIsMobile's breakpoint is max-width 639px.
    await dashboardPage.page.setViewportSize({ width: 375, height: 812 });
    await dashboardPage.goto();

    const nav = dashboardPage.page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();
    for (const label of ['Budget', 'Accounts', 'Insights', 'Settings']) {
      await expect(nav.getByRole('button', { name: label })).toBeVisible();
    }
    // Sign out is not in the bar on mobile — it lives in Settings.
    await expect(nav.getByRole('button', { name: 'Log out' })).toHaveCount(0);
  });

  test('a mobile user can still sign out, from Settings', async ({ dashboardPage }) => {
    // The tab bar has room for four destinations and nothing else. If this
    // fails, phone users are stranded with no way to log out.
    await dashboardPage.page.setViewportSize({ width: 375, height: 812 });
    await dashboardPage.goto();
    await dashboardPage.page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('button', { name: 'Settings' })
      .click();
    await expect(dashboardPage.page.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  test('every destination is reachable by keyboard', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const insights = dashboardPage.page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('button', { name: 'Insights' });
    await insights.focus();
    await dashboardPage.page.keyboard.press('Enter');
    await expect(dashboardPage.page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  });
});
