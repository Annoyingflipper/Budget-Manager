import type { Page, Locator } from '@playwright/test';

export class AccountsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly grandTotal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Accounts' });
    this.addButton = page.getByRole('button', { name: /add account/i });
    this.grandTotal = page.getByTestId('grand-total');
  }

  async goto() {
    await this.page.getByText('🏦 Accounts').click();
    await this.heading.waitFor();
  }

  async add(name: string) {
    await this.addButton.click();
    const draft = this.page.getByPlaceholder(/new account name/i);
    await draft.fill(name);
    await draft.blur();
    await this.page.getByLabel(`Name for ${name}`).waitFor();
  }

  async setBalance(name: string, value: string) {
    const input = this.page.getByLabel(`Balance for ${name}`);
    await input.fill(value);
    await input.blur();
  }

  async setCurrency(name: string, code: string) {
    await this.page.getByLabel(`Currency for ${name}`).selectOption(code);
  }

  async saveRate(currency: string, date: string, value: string) {
    await this.page.getByLabel('Manual rate currency').selectOption(currency);
    await this.page.getByLabel('Manual rate date').fill(date);
    await this.page.getByLabel('Manual rate value').fill(value);
    await this.page.getByRole('button', { name: /save rate/i }).click();
  }

  async remove(name: string) {
    await this.page.getByLabel(`Delete ${name}`).click();
    await this.page.getByLabel(`Confirm delete ${name}`).click();
  }

  subtotal(currency: string): Locator {
    return this.page.getByTestId(`subtotal-${currency}`);
  }
}
