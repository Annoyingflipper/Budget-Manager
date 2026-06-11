import type { Page, Locator } from '@playwright/test';

// Scoped to the <section> that contains this category's subtotal testid.
export class CategoryTableComponent {
  readonly root: Locator;
  constructor(private page: Page, private categoryId: number) {
    this.root = page.locator('section').filter({
      has: page.getByTestId(`subtotal-${categoryId}`),
    });
  }
  get subtotal(): Locator { return this.page.getByTestId(`subtotal-${this.categoryId}`); }
  get addItemButton(): Locator { return this.root.getByRole('button', { name: '+ Add item' }); }
  get budgetBar(): Locator { return this.root.getByRole('progressbar'); }

  get draftName(): Locator { return this.root.getByPlaceholder('Item name'); }
  get draftProjected(): Locator { return this.root.getByLabel('Projected'); }
  get draftActual(): Locator { return this.root.getByLabel('Actual'); }

  async addItem(name: string, projected: number, actual: number): Promise<void> {
    await this.addItemButton.click();
    await this.draftName.fill(name);
    await this.draftProjected.fill(String(projected));
    await this.draftActual.fill(String(actual));
    await this.draftName.press('Enter');
  }
}
