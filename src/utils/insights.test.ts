import { describe, it, expect } from 'vitest';
import { categoryTotals, buildMonthDelta, budgetToExportRows } from './insights';
import type { Budget, CategoryTotal } from '../types';

function budget(): Budget {
  return {
    income: { projected: 5000, actual: 5000 },
    categories: [
      {
        id: 1, name: 'Food', display_order: 0, icon: '🍔',
        items: [
          { id: 11, category_id: 1, name: 'Groceries', projected: 400, actual: 450, paidOn: null },
          { id: 12, category_id: 1, name: 'Dining', projected: 200, actual: 180, paidOn: null },
        ],
      },
      {
        id: 2, name: 'Rent', display_order: 1, icon: '🏠',
        items: [{ id: 21, category_id: 2, name: 'Apartment', projected: 1650, actual: 1650, paidOn: null }],
      },
    ],
  };
}

describe('categoryTotals', () => {
  it('sums projected and actual per category', () => {
    expect(categoryTotals(budget())).toEqual([
      { id: 1, name: 'Food', icon: '🍔', projected: 600, actual: 630 },
      { id: 2, name: 'Rent', icon: '🏠', projected: 1650, actual: 1650 },
    ]);
  });
});

describe('buildMonthDelta', () => {
  const current: CategoryTotal[] = [
    { id: 1, name: 'Food', icon: '🍔', projected: 600, actual: 630 },
    { id: 2, name: 'Rent', icon: '🏠', projected: 1650, actual: 1650 },
  ];

  it('returns hasPrior:false when there is no previous month', () => {
    expect(buildMonthDelta(current, null)).toEqual({ hasPrior: false });
  });

  it('computes per-category actual deltas (current minus previous)', () => {
    const previous: CategoryTotal[] = [
      { id: 1, name: 'Food', icon: '🍔', projected: 600, actual: 500 },
      { id: 2, name: 'Rent', icon: '🏠', projected: 1650, actual: 1650 },
    ];
    const result = buildMonthDelta(current, previous);
    expect(result).toEqual({
      hasPrior: true,
      rows: [
        { id: 1, name: 'Food', icon: '🍔', currentActual: 630, prevActual: 500, delta: 130 },
        { id: 2, name: 'Rent', icon: '🏠', currentActual: 1650, prevActual: 1650, delta: 0 },
      ],
    });
  });

  it('treats a category missing on one side as 0, current categories first', () => {
    const previous: CategoryTotal[] = [
      { id: 3, name: 'Gym', icon: '🏋️', projected: 50, actual: 50 },
    ];
    const result = buildMonthDelta(current, previous);
    expect(result).toEqual({
      hasPrior: true,
      rows: [
        { id: 1, name: 'Food', icon: '🍔', currentActual: 630, prevActual: 0, delta: 630 },
        { id: 2, name: 'Rent', icon: '🏠', currentActual: 1650, prevActual: 0, delta: 1650 },
        { id: 3, name: 'Gym', icon: '🏋️', currentActual: 0, prevActual: 50, delta: -50 },
      ],
    });
  });
});

describe('budgetToExportRows', () => {
  it('flattens to one row per line item with the given month', () => {
    expect(budgetToExportRows('2026-06-01', budget())).toEqual([
      { month: '2026-06-01', category: 'Food', item: 'Groceries', projected: 400, actual: 450 },
      { month: '2026-06-01', category: 'Food', item: 'Dining', projected: 200, actual: 180 },
      { month: '2026-06-01', category: 'Rent', item: 'Apartment', projected: 1650, actual: 1650 },
    ]);
  });
});
