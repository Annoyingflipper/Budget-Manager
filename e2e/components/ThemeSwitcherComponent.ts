import type { Page, Locator } from '@playwright/test';

// Theme controls on the Settings page (radiogroups for mode + theme).
export class ThemeSwitcherComponent {
  constructor(private page: Page) {}
  get modeGroup(): Locator { return this.page.getByRole('radiogroup', { name: 'Color mode' }); }
  get themeGroup(): Locator { return this.page.getByRole('radiogroup', { name: 'Theme' }); }

  async setMode(mode: 'Light' | 'Dark'): Promise<void> {
    await this.modeGroup.getByRole('radio', { name: new RegExp(mode) }).click();
  }
  async setTheme(theme: 'Peach' | 'Sage' | 'Lavender'): Promise<void> {
    await this.themeGroup.getByRole('radio', { name: new RegExp(theme, 'i') }).click();
  }
  async dataTheme(): Promise<string | null> {
    return this.page.locator('html').getAttribute('data-theme');
  }
  async dataMode(): Promise<string | null> {
    return this.page.locator('html').getAttribute('data-mode');
  }
  async cssVar(name: string): Promise<string> {
    return this.page.evaluate(
      (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
      name,
    );
  }
}
