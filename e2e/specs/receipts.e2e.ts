import { test, expect } from '../fixtures/test';
import AxeBuilder from '@axe-core/playwright';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';
import { MONTH_CURRENT } from '../data/baseline';

/** A tiny but valid PNG, so the upload path exercises real image handling. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngFile(name: string) {
  return { name, mimeType: 'image/png', buffer: Buffer.from(PNG_BASE64, 'base64') };
}

async function attachmentRows(lineItemId: number) {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);
  const { data, error } = await admin
    .from('line_item_attachments')
    .select('id, storage_path')
    .eq('user_id', uid)
    .eq('line_item_id', lineItemId);
  if (error) throw error;
  return data ?? [];
}

// These specs all upload to one shared bucket and all render the same month, so
// each one's expenses (and signed-URL fetches) show up in the others' pages.
// Running them serially keeps the upload/refetch timing deterministic.
test.describe.configure({ mode: 'serial' });

test.describe('receipt attachments @regression', () => {
  test('@smoke attaches a receipt, views it, and deletes it', async ({
    dashboardPage,
    scopedData,
  }) => {
    const { itemId } = await scopedData.createCategoryWithItem({ periodMonth: MONTH_CURRENT });

    await dashboardPage.goto();
    const row = dashboardPage.page.getByTestId(`line-item-${itemId}`);

    await row.getByLabel('Attach a receipt').setInputFiles(pngFile('receipt-a.png'));

    // The row shows it, and the row survives a reload with the receipt attached.
    await expect(dashboardPage.page.getByTestId(`attachment-thumb-${itemId}`)).toBeVisible();
    await expect.poll(async () => (await attachmentRows(itemId)).length).toBe(1);

    await dashboardPage.page.getByTestId(`attachment-thumb-${itemId}`).click();
    const dialog = dashboardPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dashboardPage.page.getByTestId('viewer-position')).toHaveText('1 / 1');

    // Scoped to the dialog: the dashboard behind it has its own pre-existing
    // contrast/label findings, and this test is about the viewer specifically.
    const results = await new AxeBuilder({ page: dashboardPage.page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);

    await dashboardPage.page.getByRole('button', { name: /^delete attachment$/i }).click();
    await dashboardPage.page.getByRole('button', { name: /confirm delete attachment/i }).click();

    await expect.poll(async () => (await attachmentRows(itemId)).length).toBe(0);
  });

  test('holds several receipts and navigates between them', async ({
    dashboardPage,
    scopedData,
  }) => {
    const { itemId } = await scopedData.createCategoryWithItem({ periodMonth: MONTH_CURRENT });

    await dashboardPage.goto();
    const row = dashboardPage.page.getByTestId(`line-item-${itemId}`);

    await row.getByLabel('Attach a receipt').setInputFiles(pngFile('one.png'));
    await expect.poll(async () => (await attachmentRows(itemId)).length).toBe(1);
    await row.getByLabel('Attach a receipt').setInputFiles(pngFile('two.png'));
    await expect.poll(async () => (await attachmentRows(itemId)).length).toBe(2);

    // The badge comes from an async refetch after upload, which lags under a
    // fully-loaded parallel suite — hence the longer window.
    await expect(dashboardPage.page.getByTestId(`attachment-count-${itemId}`))
      .toHaveText('×2', { timeout: 20_000 });

    await dashboardPage.page.getByTestId(`attachment-thumb-${itemId}`).click();
    await expect(dashboardPage.page.getByTestId('viewer-position'))
      .toHaveText('1 / 2', { timeout: 20_000 });
    await dashboardPage.page.getByRole('button', { name: /next attachment/i }).click();
    await expect(dashboardPage.page.getByTestId('viewer-position')).toHaveText('2 / 2');

    await dashboardPage.page.keyboard.press('Escape');
    await expect(dashboardPage.page.getByRole('dialog')).toHaveCount(0);
  });

  // The FK cascade removes the rows but cannot reach Storage — this is the check
  // that the client-side cleanup actually runs.
  test('deleting an expense removes its rows and its stored files', async ({
    dashboardPage,
    scopedData,
  }) => {
    const { itemId } = await scopedData.createCategoryWithItem({ periodMonth: MONTH_CURRENT });

    await dashboardPage.goto();
    const row = dashboardPage.page.getByTestId(`line-item-${itemId}`);
    await row.getByLabel('Attach a receipt').setInputFiles(pngFile('doomed.png'));
    await expect.poll(async () => (await attachmentRows(itemId)).length).toBe(1);

    const paths = (await attachmentRows(itemId)).map((r) => r.storage_path as string);
    expect(paths).toHaveLength(1);

    await row.getByLabel('Delete row').click();
    await row.getByLabel('Confirm delete').click();

    await expect.poll(async () => (await attachmentRows(itemId)).length).toBe(0);

    // And the object itself is gone, not just the row pointing at it.
    const { data: remaining } = await admin.storage.from('receipts').list(
      paths[0].split('/').slice(0, 2).join('/'),
    );
    expect(remaining ?? []).toHaveLength(0);
  });
});
