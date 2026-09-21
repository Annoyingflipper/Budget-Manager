import { test, expect } from '../fixtures/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The unscoped scans. Chunk 3's acceptance criterion is that these pass
 * without narrowing to a subtree.
 *
 * Every scan here waits for the page's ASYNC content before analysing.
 * That is not politeness — theme-switching.e2e.ts's Settings scan passed
 * for years while the page was failing, because it waited only for a
 * heading that renders immediately and scanned before CategoriesEditor's
 * fetch resolved. An axe scan that runs against an empty page is a green
 * test that proves nothing.
 */
async function seriousOrCritical(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('accessibility @a11y', () => {
  test('the dashboard has no serious or critical violations, unscoped', async ({
    dashboardPage,
  }) => {
    await dashboardPage.goto();
    // Wait for real line items, not just the shell: the nine unlabelled
    // inputs this scan exists to catch live inside CategoryTable's rows.
    // Anchored to a line-item row (not IncomeSummary's Projected field,
    // which renders before any category data arrives and would let this
    // wait pass against an empty budget).
    await expect(
      dashboardPage.page.locator('[data-testid^="line-item-"]').first(),
    ).toBeVisible();

    const violations = await seriousOrCritical(dashboardPage.page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('the dashboard has no serious or critical violations on a phone', async ({
    dashboardPage,
  }) => {
    // The mobile layout is a different tree — tab bar instead of sidebar,
    // stacked rows instead of an 8-column grid.
    await dashboardPage.page.setViewportSize({ width: 375, height: 812 });
    await dashboardPage.goto();
    await expect(
      dashboardPage.page.locator('[data-testid^="line-item-"]').first(),
    ).toBeVisible();

    const violations = await seriousOrCritical(dashboardPage.page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
