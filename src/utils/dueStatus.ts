import { addDays } from './date';
import { sum } from './money';
import type { CategoryWithItems, LineItem } from '../types';

export type DueBucket = 'overdue' | 'dueSoon' | 'later';

export type DueGroup = {
  items: LineItem[];
  count: number;
  amount: number;
};

export type DueSummary = {
  overdue: DueGroup;
  dueSoon: DueGroup;
  later: DueGroup;
  /** overdue + dueSoon — what the cash-flow verdict compares against. */
  actionableAmount: number;
  /** True when nothing is both unpaid and dated, so the panel hides entirely. */
  isEmpty: boolean;
};

/**
 * One item's bucket, or null when it does not belong in any of them.
 *
 * Dates compare as strings: `YYYY-MM-DD` sorts lexicographically, so this needs
 * no Date objects and cannot drift by a day across timezones.
 */
export function bucketFor(
  item: LineItem,
  today: string,
  horizonDays = 7,
): DueBucket | null {
  if (item.paidOn !== null) return null; // a paid bill is not due
  if (item.dueOn === null) return null;  // undated: StillToPay still counts it
  if (item.dueOn < today) return 'overdue';
  if (item.dueOn <= addDays(today, horizonDays)) return 'dueSoon';
  return 'later';
}

function group(items: LineItem[]): DueGroup {
  const sorted = [...items].sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? ''));
  return {
    items: sorted,
    count: sorted.length,
    amount: sum(sorted.map((i) => i.baseProjected)),
  };
}

/** Every unpaid, dated item across all categories, split into three buckets. */
export function summariseDue(
  categories: CategoryWithItems[],
  today: string,
  horizonDays = 7,
): DueSummary {
  const buckets: Record<DueBucket, LineItem[]> = { overdue: [], dueSoon: [], later: [] };

  for (const item of categories.flatMap((c) => c.items)) {
    const bucket = bucketFor(item, today, horizonDays);
    if (bucket !== null) buckets[bucket].push(item);
  }

  const overdue = group(buckets.overdue);
  const dueSoon = group(buckets.dueSoon);
  const later = group(buckets.later);

  return {
    overdue,
    dueSoon,
    later,
    actionableAmount: Math.round((overdue.amount + dueSoon.amount) * 100) / 100,
    isEmpty: overdue.count + dueSoon.count + later.count === 0,
  };
}
