// The canonical seeded dataset. reseedTestUser() (support/seed.ts) writes exactly
// this; read-only specs assert against it. Keep numbers stable.

import { addMonths, currentMonth } from '../support/months';

// Relative to the real calendar, never pinned to a literal. These were hard-coded
// to June 2026 originally, which silently rotted the suite once the calendar moved
// past it: delete-month rolls over to MONTH_CURRENT + 1 and needs that to still be
// a *future* month for the delete control to render at all.
export const MONTH_CURRENT = currentMonth();
export const MONTH_PRIOR = addMonths(MONTH_CURRENT, -1);

export type SeedCategory = { name: string; display_order: number; icon: string };

// Matches the signup seed trigger (0014). Reseed resets to exactly these.
export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Services', display_order: 1, icon: '🛠' },
  { name: 'Entertainment', display_order: 2, icon: '🎬' },
  { name: 'Loans', display_order: 3, icon: '🏦' },
  { name: 'Taxes', display_order: 4, icon: '📋' },
  { name: 'Savings or Investments', display_order: 5, icon: '💎' },
  { name: 'Monthly Payments', display_order: 6, icon: '🧾' },
  { name: 'Personal Care', display_order: 7, icon: '🧴' },
  { name: 'Other', display_order: 8, icon: '✨' },
];

export type SeedItem = {
  category: string; // category name -> resolved to id at seed time
  name: string;
  projected: number;
  actual: number;
};

export const INCOME = {
  [MONTH_CURRENT]: { projected: 5000, actual: 5000 },
  [MONTH_PRIOR]: { projected: 5000, actual: 5000 },
} as const;

// Current month: Services actual 135 > projected 130 (OVER/red);
//                Entertainment actual 25 < projected 30 (UNDER/green).
export const ITEMS_CURRENT: SeedItem[] = [
  { category: 'Services', name: 'Internet', projected: 80, actual: 85 },
  { category: 'Services', name: 'Phone', projected: 50, actual: 50 },
  { category: 'Entertainment', name: 'Streaming', projected: 30, actual: 25 },
];

// Prior-month actuals differ so the "vs last month" delta is non-zero:
//   Services prior 80; current 135 -> +55.
//   Entertainment prior 40; current 25 -> -15.
export const ITEMS_PRIOR: SeedItem[] = [
  { category: 'Services', name: 'Internet', projected: 80, actual: 80 },
  { category: 'Entertainment', name: 'Streaming', projected: 30, actual: 40 },
];

// Convenience for assertions. Named for the seeded month's *role*, not its
// calendar name — the months move with the real clock.
export const CURRENT_SERVICES_ACTUAL = 135; // 85 + 50
export const CURRENT_SERVICES_PROJECTED = 130; // 80 + 50
export const CURRENT_ENTERTAINMENT_ACTUAL = 25;
export const CURRENT_ENTERTAINMENT_PROJECTED = 30;
export const SERVICES_DELTA = CURRENT_SERVICES_ACTUAL - 80; // +55 vs prior month
export const ENTERTAINMENT_DELTA = CURRENT_ENTERTAINMENT_ACTUAL - 40; // -15 vs prior month
