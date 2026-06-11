import type { Page, Locator } from '@playwright/test';

export class HeaderComponent {
  readonly root: Locator;
  constructor(page: Page) {
    this.root = page.locator('header').first();
  }
  get prevMonth(): Locator { return this.root.getByRole('button', { name: 'Previous month' }); }
  get nextMonth(): Locator { return this.root.getByRole('button', { name: 'Next month' }); }
  get startNextMonth(): Locator { return this.root.getByRole('button', { name: /^Start / }); }
  get deleteMonthButton(): Locator { return this.root.getByRole('button', { name: 'Delete this month' }); }
  get monthLabel(): Locator { return this.root.getByText(/^[A-Z][a-z]+ \d{4}$/); }
  get modeToggle(): Locator { return this.root.getByRole('button', { name: 'Toggle color mode' }); }
  get insightsButton(): Locator { return this.root.getByRole('button', { name: /Insights/ }); }
  get settingsButton(): Locator { return this.root.getByRole('button', { name: /Settings/ }); }
  get logoutButton(): Locator { return this.root.getByRole('button', { name: 'Log out' }); }

  async goPrev(): Promise<void> { await this.prevMonth.click(); }
  async openInsights(): Promise<void> { await this.insightsButton.click(); }
  async openSettings(): Promise<void> { await this.settingsButton.click(); }
  async toggleMode(): Promise<void> { await this.modeToggle.click(); }
}
