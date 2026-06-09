import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}
  get email(): Locator { return this.page.getByPlaceholder('Email'); }
  get password(): Locator { return this.page.getByPlaceholder('Password'); }
  get submit(): Locator { return this.page.getByRole('button', { name: /log in/i }); }
  get error(): Locator { return this.page.locator('p.text-negative'); }

  async goto(): Promise<void> { await this.page.goto('/'); }
  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
