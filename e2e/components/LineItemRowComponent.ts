import type { Page, Locator } from '@playwright/test';

export class LineItemRowComponent {
  readonly root: Locator;
  constructor(page: Page, itemId: number) {
    this.root = page.getByTestId(`line-item-${itemId}`);
  }
  get nameInput(): Locator { return this.root.locator('input[type="text"]'); }
  get projectedInput(): Locator { return this.root.locator('input[type="number"]').nth(0); }
  get actualInput(): Locator { return this.root.locator('input[type="number"]').nth(1); }
  get deleteButton(): Locator { return this.root.getByRole('button', { name: 'Delete row' }); }
  get confirmDeleteButton(): Locator { return this.root.getByRole('button', { name: 'Confirm delete' }); }

  async setActual(value: number): Promise<void> {
    await this.actualInput.fill(String(value));
    await this.actualInput.blur();
  }
  async setProjected(value: number): Promise<void> {
    await this.projectedInput.fill(String(value));
    await this.projectedInput.blur();
  }
  async delete(): Promise<void> {
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
  }
}
