import { test, expect } from '../fixtures/test';
import { MONTH_CURRENT } from '../data/baseline';
import { todayISO } from '../support/months';

function shiftDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ComingUp aggregates due dates across the WHOLE current month for the shared
// test user, not just the fixture rows a given test created (see src/components/
// ComingUp.tsx). Under fullyParallel, two of these tests setting an overdue due
// date in the same real calendar month land in the same bucket totals and each
// other's item counts — the exact same "shared mutable pool" problem
// accounts.e2e.ts documents. Serialize the whole file so no two due-date
// mutations in MONTH_CURRENT are ever in flight together.
//
// The rollover regression test used to live here as a nested describe.serial.
// It moved to rollover.e2e.ts: serializing it against THIS file was not enough,
// because it creates MONTH_CURRENT + 1 for the shared test user and other spec
// FILES run in parallel. See that file's header for the failure it caused.
test.describe.configure({ mode: 'serial' });

test.describe('due dates @regression', () => {
  test('buckets a bill by its due date and drops it once paid', async ({
    dashboardPage,
    scopedData,
  }) => {
    const { itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 310,
      actual: 0,
    });

    await dashboardPage.goto();
    const row = dashboardPage.lineItem(itemId);

    // Past due → overdue.
    await row.setDue(shiftDays(todayISO(), -3));
    await expect(dashboardPage.overdueBucket).toContainText('310.00');

    // Inside the week → due soon.
    await row.setDue(shiftDays(todayISO(), 2));
    await expect(dashboardPage.dueSoonBucket).toContainText('310.00');
    await expect(dashboardPage.overdueBucket).toBeHidden();

    // Paid bills are not due.
    await row.markPaid();
    await expect(dashboardPage.dueSoonBucket).toBeHidden();
  });

  test('expands a bucket to name the bill', async ({ dashboardPage, scopedData }) => {
    const { itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      itemName: 'Electric bill',
      projected: 75,
      actual: 0,
    });

    await dashboardPage.goto();
    await dashboardPage.lineItem(itemId).setDue(shiftDays(todayISO(), 1));
    await dashboardPage.dueSoonBucket.click();
    await expect(dashboardPage.comingUp).toContainText('Electric bill');
  });
});
