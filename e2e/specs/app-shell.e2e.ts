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
    await expect(dashboardPage.page.getByRole('button', { name: 'Log out' })).toBeInViewport();
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

  // This lives in Playwright, not Vitest, on purpose: jsdom has no layout
  // engine at all, so a unit test rendering SidebarNav in isolation has no
  // tall sibling to stretch against and cannot see this bug. Playwright's
  // own `click()` also auto-scrolls before clicking, which is exactly what
  // let the old modeToggle/logoutButton assertions pass against a sidebar
  // that had already scrolled off screen — so this test deliberately uses
  // toBeInViewport() instead of interacting with the controls.
  //
  // The no-scroll assertion below is the load-bearing one. A version of
  // this test that only scrolls to the bottom and checks visibility there
  // passes even against the unfixed layout: with no `items-start`, the
  // sidebar stretches to the height of its tallest sibling (the dashboard),
  // and `mt-auto` pins the toggle/logout block to the bottom of that
  // stretched height — which, because of the page's own `p-4` padding, sits
  // within a few pixels of the document's actual bottom edge. So scrolling
  // all the way down happens to land the viewport exactly on the one spot
  // where the broken layout's controls are visible. Checking at page load,
  // before any scroll, is what actually distinguishes "persistent sidebar"
  // from "sidebar whose controls are stranded thousands of pixels down".
  test("the desktop sidebar's controls stay on screen without scrolling, and stay put when you do", async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const nav = dashboardPage.page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();

    const logoutButton = nav.getByRole('button', { name: 'Log out' });
    const modeToggle = nav.getByRole('button', { name: 'Toggle color mode' });

    // 1. No scrolling at all — this is the assertion that fails against the
    // unfixed layout, and the one that proves the sidebar is persistent.
    await expect(logoutButton).toBeInViewport();
    await expect(modeToggle).toBeInViewport();

    // 2. Scroll to the bottom of the (long) dashboard content. On its own
    // this proves nothing — see the comment above — but once the sidebar is
    // sticky, this is a real guard that it stays pinned to the viewport
    // rather than scrolling away with the page content.
    await dashboardPage.page.mouse.wheel(0, 100000);
    await expect(logoutButton).toBeInViewport();
    await expect(modeToggle).toBeInViewport();
  });
});
