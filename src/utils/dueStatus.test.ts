import { describe, it, expect } from 'vitest';
import { bucketFor, summariseDue } from './dueStatus';
import type { CategoryWithItems, LineItem } from '../types';

const TODAY = '2026-08-24';

function item(over: Partial<LineItem> = {}): LineItem {
  return {
    id: 1,
    category_id: 1,
    name: 'Rent',
    projected: 100,
    actual: 0,
    paidOn: null,
    dueOn: null,
    currency: null,
    rateUnitsPerUsd: null,
    baseProjected: 100,
    baseActual: 0,
    rateResolved: true,
    ...over,
  };
}

function categories(items: LineItem[]): CategoryWithItems[] {
  return [{ id: 1, name: 'Bills', display_order: 1, icon: '🧾', items }];
}

describe('bucketFor', () => {
  it('returns null for a paid item even when it is past due', () => {
    expect(bucketFor(item({ dueOn: '2026-08-01', paidOn: '2026-08-02' }), TODAY)).toBeNull();
  });

  it('returns null when no due date is set', () => {
    expect(bucketFor(item({ dueOn: null }), TODAY)).toBeNull();
  });

  it('buckets a past date as overdue', () => {
    expect(bucketFor(item({ dueOn: '2026-08-23' }), TODAY)).toBe('overdue');
  });

  it('buckets today as dueSoon, not overdue', () => {
    expect(bucketFor(item({ dueOn: TODAY }), TODAY)).toBe('dueSoon');
  });

  it('includes the far edge of the horizon in dueSoon', () => {
    expect(bucketFor(item({ dueOn: '2026-08-31' }), TODAY)).toBe('dueSoon');
  });

  it('buckets one day past the horizon as later', () => {
    expect(bucketFor(item({ dueOn: '2026-09-01' }), TODAY)).toBe('later');
  });

  it('respects a custom horizon', () => {
    expect(bucketFor(item({ dueOn: '2026-08-28' }), TODAY, 3)).toBe('later');
    expect(bucketFor(item({ dueOn: '2026-08-27' }), TODAY, 3)).toBe('dueSoon');
  });
});

describe('summariseDue', () => {
  it('is empty when nothing is unpaid and dated', () => {
    const summary = summariseDue(categories([item(), item({ paidOn: TODAY, dueOn: TODAY })]), TODAY);
    expect(summary.isEmpty).toBe(true);
    expect(summary.overdue.count).toBe(0);
  });

  it('groups items into the three buckets with counts and totals', () => {
    const summary = summariseDue(
      categories([
        item({ id: 1, dueOn: '2026-08-20', baseProjected: 200 }),
        item({ id: 2, dueOn: '2026-08-21', baseProjected: 110 }),
        item({ id: 3, dueOn: '2026-08-26', baseProjected: 845 }),
        item({ id: 4, dueOn: '2026-09-15', baseProjected: 90 }),
      ]),
      TODAY,
    );
    expect(summary.overdue.count).toBe(2);
    expect(summary.overdue.amount).toBe(310);
    expect(summary.dueSoon.amount).toBe(845);
    expect(summary.later.amount).toBe(90);
    expect(summary.isEmpty).toBe(false);
  });

  it('actionableAmount is overdue plus dueSoon, excluding later', () => {
    const summary = summariseDue(
      categories([
        item({ id: 1, dueOn: '2026-08-20', baseProjected: 310 }),
        item({ id: 2, dueOn: '2026-08-26', baseProjected: 845 }),
        item({ id: 3, dueOn: '2026-09-15', baseProjected: 90 }),
      ]),
      TODAY,
    );
    expect(summary.actionableAmount).toBe(1155);
  });

  it('sums baseProjected, not the native amount', () => {
    // 30,000 Bs recorded natively, worth $40 in the base currency.
    const summary = summariseDue(
      categories([
        item({ dueOn: '2026-08-26', projected: 30000, baseProjected: 40, currency: 'VES' }),
      ]),
      TODAY,
    );
    expect(summary.dueSoon.amount).toBe(40);
  });

  it('sorts each bucket by due date ascending', () => {
    const summary = summariseDue(
      categories([
        item({ id: 1, dueOn: '2026-08-22' }),
        item({ id: 2, dueOn: '2026-08-19' }),
      ]),
      TODAY,
    );
    expect(summary.overdue.items.map((i) => i.id)).toEqual([2, 1]);
  });

  it('collects items across several categories', () => {
    const summary = summariseDue(
      [
        { id: 1, name: 'A', display_order: 1, icon: '🧾', items: [item({ id: 1, dueOn: '2026-08-20' })] },
        { id: 2, name: 'B', display_order: 2, icon: '🎬', items: [item({ id: 2, dueOn: '2026-08-21' })] },
      ],
      TODAY,
    );
    expect(summary.overdue.count).toBe(2);
  });
});
