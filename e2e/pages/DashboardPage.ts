import type { Page, Locator } from '@playwright/test';
import { HeaderComponent } from '../components/HeaderComponent';
import { ToastComponent } from '../components/ToastComponent';
import { CategoryTableComponent } from '../components/CategoryTableComponent';
import { LineItemRowComponent } from '../components/LineItemRowComponent';

export class DashboardPage {
  readonly header: HeaderComponent;
  readonly toast: ToastComponent;
  constructor(public readonly page: Page) {
    this.header = new HeaderComponent(page);
    this.toast = new ToastComponent(page);
  }
  get projectedBalance(): Locator { return this.page.getByTestId('projected-balance'); }
  get actualBalance(): Locator { return this.page.getByTestId('actual-balance'); }

  async goto(): Promise<void> { await this.page.goto('/'); }
  categoryTable(categoryId: number): CategoryTableComponent {
    return new CategoryTableComponent(this.page, categoryId);
  }
  lineItem(itemId: number): LineItemRowComponent {
    return new LineItemRowComponent(this.page, itemId);
  }
}
