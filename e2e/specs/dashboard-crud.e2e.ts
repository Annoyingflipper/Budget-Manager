import { test, expect } from '../fixtures/test';
import { MONTH_CURRENT } from '../data/baseline';

test.describe('dashboard CRUD @smoke @regression', () => {
  test('edits actual -> subtotal updates', async ({ dashboardPage, scopedData }) => {
    const { categoryId, itemId, projected } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 100,
      actual: 60,
    });

    await dashboardPage.goto();
    const table = dashboardPage.categoryTable(categoryId);
    await expect(table.subtotal).toContainText('$60.00');

    await dashboardPage.lineItem(itemId).setActual(90);

    // Subtotal now shows projected/actual = 100.00 / 90.00.
    await expect(table.subtotal).toContainText('$90.00');
    await expect(table.subtotal).toContainText(`$${projected.toFixed(2)}`);
  });

  test('adds an item -> subtotal increases by its projected', async ({ dashboardPage, scopedData }) => {
    const { categoryId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 100,
      actual: 100,
    });

    await dashboardPage.goto();
    const table = dashboardPage.categoryTable(categoryId);
    await expect(table.subtotal).toContainText('$100.00');

    await table.addItem('Added Item', 25, 25);

    // New projected subtotal = 125.00.
    await expect(table.subtotal).toContainText('$125.00');
  });

  test('deletes an item via ✕→✓ -> category empties', async ({ dashboardPage, scopedData }) => {
    const { categoryId, itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 40,
      actual: 40,
    });

    await dashboardPage.goto();
    const table = dashboardPage.categoryTable(categoryId);
    await expect(table.subtotal).toContainText('$40.00');

    await dashboardPage.lineItem(itemId).delete();

    // Category now has zero items; it collapses to the empty card (no subtotal).
    await expect(dashboardPage.page.getByTestId(`subtotal-${categoryId}`)).toHaveCount(0);
  });
});
