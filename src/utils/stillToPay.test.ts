import { describe, it, expect } from 'vitest';
import { stillToPay } from './stillToPay';
import type { CategoryWithItems } from '../types';

function cat(
  id: number,
  items: Array<{ projected: number; paidOn: string | null }>,
): CategoryWithItems {
  return {
    id,
    name: `Cat${id}`,
    display_order: id,
    icon: '',
    items: items.map((i, idx) => ({
      id: id * 100 + idx,
      category_id: id,
      name: `Item${idx}`,
      projected: i.projected,
      actual: 0,
      paidOn: i.paidOn,
    })),
  };
}

describe('stillToPay', () => {
  it('returns zeroes for no categories', () => {
    expect(stillToPay([])).toEqual({ count: 0, amount: 0 });
  });

  it('returns zeroes when every item is paid', () => {
    const cats = [cat(1, [{ projected: 50, paidOn: '2026-06-02' }])];
    expect(stillToPay(cats)).toEqual({ count: 0, amount: 0 });
  });

  it('counts and sums projected for unpaid items only', () => {
    const cats = [
      cat(1, [
        { projected: 100, paidOn: null },
        { projected: 50, paidOn: '2026-06-01' },
      ]),
      cat(2, [
        { projected: 20.5, paidOn: null },
      ]),
    ];
    expect(stillToPay(cats)).toEqual({ count: 2, amount: 120.5 });
  });
});
