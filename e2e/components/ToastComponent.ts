import type { Page, Locator } from '@playwright/test';

export class ToastComponent {
  readonly root: Locator;
  constructor(page: Page) {
    this.root = page.getByRole('status');
  }
  get message(): Locator { return this.root; }
}
