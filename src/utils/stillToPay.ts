import { sum } from './money';
import type { CategoryWithItems } from '../types';

export type StillToPay = { count: number; amount: number };

/** Outstanding (unpaid) line items across all categories for one month. */
export function stillToPay(categories: CategoryWithItems[]): StillToPay {
  const unpaid = categories.flatMap((c) => c.items).filter((i) => i.paidOn === null);
  return { count: unpaid.length, amount: sum(unpaid.map((i) => i.projected)) };
}
