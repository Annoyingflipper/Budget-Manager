import { test, expect } from '../fixtures/test';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';

async function firstServicesItemId(): Promise<number> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);
  const { data: cat } = await admin
    .from('categories').select('id').eq('user_id', uid).eq('name', 'Services').single();
  const { data: item, error } = await admin
    .from('line_items')
    .select('id')
    .eq('user_id', uid)
    .eq('category_id', cat!.id)
    .eq('period_month', '2026-06-01')
    .order('created_at')
    .limit(1)
    .single();
  if (error) throw error;
  return item!.id as number;
}

test.describe('paid dates @regression', () => {
  test.afterEach(async () => {
    const itemId = await firstServicesItemId();
    await admin.from('line_items').update({ paid_on: null }).eq('id', itemId);
  });

  test('mark a bill paid then un-pay it, summary updates', async ({ dashboardPage }) => {
    const itemId = await firstServicesItemId();
    await dashboardPage.goto();
    await expect(dashboardPage.header.monthLabel).toHaveText('June 2026');

    const row = dashboardPage.lineItem(itemId);

    // Baseline: item is unpaid → "Mark paid" visible, summary shows outstanding bills.
    await expect(row.markPaidButton).toBeVisible();
    await expect(dashboardPage.stillToPay).toContainText('bills left');
    const beforeText = await dashboardPage.stillToPay.textContent();

    // Mark paid → date input appears, "Mark paid" gone.
    await row.markPaid();
    await expect(row.paidDateInput).toBeVisible();
    await expect(row.markPaidButton).toHaveCount(0);
    // Wait for the DB write to settle (optimistic update already visible; we need
    // the write to land before navigating so the reload can confirm persistence).
    await dashboardPage.page.waitForLoadState('networkidle');
    // Confirm the paid state is still showing after network settled (not reverted).
    await expect(row.paidDateInput).toBeVisible();

    // DB check: paid_on is now set in Supabase (service-role bypass for direct verification).
    const uid = await getTestUserId(env.E2E_USER_EMAIL);
    const { data: dbRow } = await admin
      .from('line_items').select('paid_on').eq('id', itemId).eq('user_id', uid).single();
    expect(dbRow?.paid_on).not.toBeNull();

    // Re-navigate (via goto, which also dismisses the changelog modal) → paid state persisted.
    await dashboardPage.goto();
    await expect(dashboardPage.lineItem(itemId).paidDateInput).toBeVisible();

    // Assert summary updated to reflect the paid item (count decremented or all-paid).
    await expect(dashboardPage.stillToPay).not.toHaveText(beforeText ?? '');

    // Un-pay → "Mark paid" returns.
    await dashboardPage.lineItem(itemId).clearPaid();
    await expect(dashboardPage.lineItem(itemId).markPaidButton).toBeVisible();
  });
});
