// The canonical seeded dataset. reseedTestUser() (support/seed.ts) writes exactly
// this; read-only specs assert against it. Keep numbers stable.

export const MONTH_CURRENT = '2026-06-01';
export const MONTH_PRIOR = '2026-05-01';

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

// June: Services actual 135 > projected 130 (OVER/red);
//       Entertainment actual 25 < projected 30 (UNDER/green).
export const ITEMS_CURRENT: SeedItem[] = [
  { category: 'Services', name: 'Internet', projected: 80, actual: 85 },
  { category: 'Services', name: 'Phone', projected: 50, actual: 50 },
  { category: 'Entertainment', name: 'Streaming', projected: 30, actual: 25 },
];

// May actuals differ so the "vs last month" delta is non-zero:
//   Services May actual 80; June 135 -> +55.
//   Entertainment May 40; June 25 -> -15.
export const ITEMS_PRIOR: SeedItem[] = [
  { category: 'Services', name: 'Internet', projected: 80, actual: 80 },
  { category: 'Entertainment', name: 'Streaming', projected: 30, actual: 40 },
];

// Convenience for assertions.
export const JUNE_SERVICES_ACTUAL = 135; // 85 + 50
export const JUNE_SERVICES_PROJECTED = 130; // 80 + 50
export const JUNE_ENTERTAINMENT_ACTUAL = 25;
export const JUNE_ENTERTAINMENT_PROJECTED = 30;
export const SERVICES_DELTA = JUNE_SERVICES_ACTUAL - 80; // +55 vs May
export const ENTERTAINMENT_DELTA = JUNE_ENTERTAINMENT_ACTUAL - 40; // -15 vs May
