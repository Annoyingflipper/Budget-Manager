import type { Page, Locator } from '@playwright/test';

// A row in Settings → Categories editor, scoped by the category's current name.
export class CategoryRowComponent {
  readonly root: Locator;
  constructor(page: Page, name: string) {
    this.root = page
      .locator('div.grid')
      .filter({ has: page.getByRole('button', { name: `Delete ${name}` }) })
      .first();
  }
  get nameInput(): Locator { return this.root.locator('input[type="text"]'); }
  get iconButton(): Locator { return this.root.getByRole('button', { name: /^Change icon for / }); }
  get deleteButton(): Locator { return this.root.getByRole('button', { name: /^Delete / }); }
  get dragHandle(): Locator { return this.root.getByRole('button', { name: /^Drag handle for / }); }

  async rename(next: string): Promise<void> {
    await this.nameInput.fill(next);
    await this.nameInput.blur();
  }
}
