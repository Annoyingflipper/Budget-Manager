import type { Page, Locator } from '@playwright/test';
import { ThemeSwitcherComponent } from '../components/ThemeSwitcherComponent';
import { CategoryRowComponent } from '../components/CategoryRowComponent';

export class SettingsPage {
  readonly theme: ThemeSwitcherComponent;
  constructor(public readonly page: Page) {
    this.theme = new ThemeSwitcherComponent(page);
  }
  get heading(): Locator { return this.page.getByRole('heading', { name: 'Appearance' }); }
  get backButton(): Locator { return this.page.getByRole('button', { name: /Back to budget/ }); }
  get addCategoryButton(): Locator { return this.page.getByRole('button', { name: '+ Add category' }); }
  get newCategoryInput(): Locator { return this.page.getByPlaceholder('New category name'); }
  get whatsNewButton(): Locator { return this.page.getByRole('button', { name: /What's new/ }); }

  categoryRow(name: string): CategoryRowComponent {
    return new CategoryRowComponent(this.page, name);
  }
  async addCategory(name: string): Promise<void> {
    await this.addCategoryButton.click();
    await this.newCategoryInput.fill(name);
    await this.newCategoryInput.press('Enter');
  }
  deleteDialog(categoryName: string): Locator {
    return this.page.getByRole('dialog', { name: `Delete ${categoryName}` });
  }
}
