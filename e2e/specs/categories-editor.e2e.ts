import { test, expect } from '../fixtures/test';
import { MONTH_CURRENT } from '../data/baseline';

test.describe('categories editor @regression', () => {
  test('renames a category and it persists after reload', async ({
    dashboardPage,
    settingsPage,
    scopedData,
  }) => {
    const { categoryName } = await scopedData.createCategoryWithItem({ periodMonth: MONTH_CURRENT });
    const renamed = `${categoryName} Renamed`;

    await dashboardPage.goto();
    await dashboardPage.header.openSettings();
    await expect(settingsPage.heading).toBeVisible();

    // Wait for the rename PATCH to land before reloading — saveName() fires async
    // on blur, so we intercept the Supabase REST response to confirm it committed.
    const renameRequest = settingsPage.page.waitForResponse(
      (r) => r.url().includes('/rest/v1/categories') && r.request().method() === 'PATCH',
    );
    await settingsPage.categoryRow(categoryName).rename(renamed);
    await renameRequest;
    await expect(settingsPage.page.getByRole('button', { name: `Delete ${renamed}` })).toBeVisible();

    // Persisted server-side: reload, dismiss any modal, re-open Settings.
    await settingsPage.page.reload();
    await dashboardPage.header.openSettings();
    await expect(settingsPage.page.getByRole('button', { name: `Delete ${renamed}` })).toBeVisible();
  });

  test('adds a new category', async ({ dashboardPage, settingsPage, scopedData }) => {
    const name = `E2E Added ${test.info().testId.slice(0, 6)}`;

    await dashboardPage.goto();
    await dashboardPage.header.openSettings();
    await settingsPage.addCategory(name);

    await expect(settingsPage.page.getByRole('button', { name: `Delete ${name}` })).toBeVisible();

    // Clean up the UI-created category through scopedData's admin client.
    await scopedData.cleanupByCategoryName(name);
  });

  test('changes a category icon via the emoji picker', async ({
    dashboardPage,
    settingsPage,
    scopedData,
  }) => {
    const { categoryName } = await scopedData.createCategoryWithItem({ periodMonth: MONTH_CURRENT });

    await dashboardPage.goto();
    await dashboardPage.header.openSettings();

    const row = settingsPage.categoryRow(categoryName);
    await row.iconButton.click();
    const picker = settingsPage.page.getByRole('dialog', { name: 'Pick an emoji' });
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: '🍔' }).click();

    await expect(row.iconButton).toContainText('🍔');
  });
});
