import type { Page, Locator } from '@playwright/test';

export class InsightsPage {
  constructor(public readonly page: Page) {}
  get heading(): Locator { return this.page.getByRole('heading', { name: 'Insights' }); }
  get backButton(): Locator { return this.page.getByRole('button', { name: /Back to budget/ }); }
  get exportThisMonth(): Locator { return this.page.getByRole('button', { name: /Export this month/ }); }
  get exportAllHistory(): Locator { return this.page.getByRole('button', { name: /Export all history/ }); }

  chartRow(categoryId: number): Locator { return this.page.getByTestId(`chart-row-${categoryId}`); }
  chartRowAmount(categoryId: number): Locator {
    return this.chartRow(categoryId).locator('span').nth(1);
  }
}
