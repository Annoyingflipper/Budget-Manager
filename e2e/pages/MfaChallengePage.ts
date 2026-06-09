import type { Page, Locator } from '@playwright/test';

export class MfaChallengePage {
  constructor(public readonly page: Page) {}
  get heading(): Locator { return this.page.getByRole('heading', { name: 'Authenticator code' }); }
  get codeInput(): Locator { return this.page.getByPlaceholder('123456'); }
  get continueButton(): Locator { return this.page.getByRole('button', { name: /continue|verifying/i }); }
  get error(): Locator { return this.page.locator('p.text-negative'); }

  async submitCode(code: string): Promise<void> {
    await this.codeInput.fill(code);
    await this.continueButton.click();
  }
}
