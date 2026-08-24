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
  get markPaidButton(): Locator { return this.root.getByRole('button', { name: 'Mark paid' }); }
  get paidDateInput(): Locator { return this.root.locator('input[type="date"][aria-label="Paid date"]'); }
  get markUnpaidButton(): Locator { return this.root.getByRole('button', { name: 'Mark unpaid' }); }
  get setDueButton(): Locator { return this.root.getByRole('button', { name: 'Set due date' }); }
  get dueDateInput(): Locator { return this.root.locator('input[type="date"][aria-label="Due date"]'); }
  get clearDueButton(): Locator { return this.root.getByRole('button', { name: 'Clear due date' }); }

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
  async markPaid(): Promise<void> {
    await this.markPaidButton.click();
  }
  async clearPaid(): Promise<void> {
    await this.markUnpaidButton.click();
  }
  async setDue(iso: string): Promise<void> {
    // isVisible() is an instant, non-waiting check — called right after a fresh
    // goto() on a just-created fixture row, it can read "not visible" simply
    // because the row hasn't rendered yet, permanently skipping the click and
    // leaving the later fill() waiting on an input that will never appear
    // (reproduced: ~50% of full-file runs failed here). click() itself already
    // auto-waits for the button to become actionable, so bound that wait and
    // treat a timeout as "already editing" (the button never existed because a
    // due date is already set) rather than "not rendered yet".
    try {
      await this.setDueButton.click({ timeout: 3000 });
    } catch {
      // No empty-state button — already in edit mode.
    }
    await this.dueDateInput.fill(iso);
    await this.dueDateInput.blur();
  }
}
