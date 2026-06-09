import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { MfaChallengePage } from '../pages/MfaChallengePage';
import { DashboardPage } from '../pages/DashboardPage';
import { SettingsPage } from '../pages/SettingsPage';
import { InsightsPage } from '../pages/InsightsPage';
import { installConsoleGuard } from './console-guard.fixture';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';

type Fixtures = {
  loginPage: LoginPage;
  mfaPage: MfaChallengePage;
  dashboardPage: DashboardPage;
  settingsPage: SettingsPage;
  insightsPage: InsightsPage;
  consoleGuard: void;
  scopedData: ScopedData;
};

// Per-test factory: creates uniquely-named, self-owned entities via the service
// role and cleans them up in teardown (even on failure). Enables parallel
// mutating specs without touching baseline rows.
export class ScopedData {
  private categoryIds: number[] = [];
  constructor(private uid: string, private prefix: string) {}

  async createCategoryWithItem(opts: {
    periodMonth: string;
    itemName?: string;
    projected?: number;
    actual?: number;
  }): Promise<{ categoryId: number; itemId: number; projected: number; actual: number; categoryName: string }> {
    const categoryName = `${this.prefix} Cat`;
    const projected = opts.projected ?? 100;
    const actual = opts.actual ?? 60;
    const { data: cat, error: catErr } = await admin
      .from('categories')
      .insert({ user_id: this.uid, name: categoryName, icon: '🧪', display_order: 9000 })
      .select('id')
      .single();
    if (catErr) throw catErr;
    const categoryId = cat.id as number;
    this.categoryIds.push(categoryId);

    const { data: item, error: itemErr } = await admin
      .from('line_items')
      .insert({
        user_id: this.uid,
        category_id: categoryId,
        name: opts.itemName ?? `${this.prefix} Item`,
        projected,
        actual,
        period_month: opts.periodMonth,
      })
      .select('id')
      .single();
    if (itemErr) throw itemErr;

    return { categoryId, itemId: item.id as number, projected, actual, categoryName };
  }

  async createEmptyCategory(): Promise<{ categoryId: number; categoryName: string }> {
    const categoryName = `${this.prefix} Empty`;
    const { data, error } = await admin
      .from('categories')
      .insert({ user_id: this.uid, name: categoryName, icon: '🧪', display_order: 9001 })
      .select('id')
      .single();
    if (error) throw error;
    const categoryId = data.id as number;
    this.categoryIds.push(categoryId);
    return { categoryId, categoryName };
  }

  /** Register + remove a category created through the UI, by its name. */
  async cleanupByCategoryName(name: string): Promise<void> {
    const { data } = await admin
      .from('categories')
      .select('id')
      .eq('user_id', this.uid)
      .eq('name', name);
    const ids = (data ?? []).map((c) => c.id as number);
    if (ids.length === 0) return;
    await admin.from('line_items').delete().in('category_id', ids);
    await admin.from('categories').delete().in('id', ids);
  }

  async cleanup(): Promise<void> {
    if (this.categoryIds.length === 0) return;
    await admin.from('line_items').delete().in('category_id', this.categoryIds);
    await admin.from('categories').delete().in('id', this.categoryIds);
    this.categoryIds = [];
  }
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  mfaPage: async ({ page }, use) => { await use(new MfaChallengePage(page)); },
  dashboardPage: async ({ page }, use) => { await use(new DashboardPage(page)); },
  settingsPage: async ({ page }, use) => { await use(new SettingsPage(page)); },
  insightsPage: async ({ page }, use) => { await use(new InsightsPage(page)); },

  consoleGuard: [
    async ({ page }, use) => {
      const errors = installConsoleGuard(page);
      await use();
      expect(errors, `Unexpected console/page/network errors:\n${errors.join('\n')}`).toEqual([]);
    },
    { auto: true },
  ],

  scopedData: async ({}, use, testInfo) => {
    const uid = await getTestUserId(env.E2E_USER_EMAIL);
    const prefix = `E2E-w${testInfo.workerIndex}-${testInfo.testId.slice(0, 6)}`;
    const data = new ScopedData(uid, prefix);
    await use(data);
    await data.cleanup();
  },
});

export { expect };
