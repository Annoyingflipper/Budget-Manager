import type { Currency } from './utils/currency';

export type Account = {
  id: number;
  name: string;
  icon: string;
  currency: Currency;
  balance: number;
  display_order: number;
};

export type Category = {
  id: number;
  name: string;
  display_order: number;
  icon: string;
};

export type LineItem = {
  id: number;
  category_id: number;
  name: string;
  /** Native stored amount, in `currency` (or the base currency when that is null). */
  projected: number;
  actual: number;
  paidOn: string | null; // ISO 'YYYY-MM-DD', or null when unpaid
  /** null = no currency set = the user's base currency. */
  currency: Currency | null;
  /** Per-expense rate override, units per USD. null = use the daily rate table. */
  rateUnitsPerUsd: number | null;
  /**
   * `projected` converted into the base currency — computed in `getBudget`, never
   * written back. Every money total in the app sums these, not the native fields.
   * Falls back to the native amount when `rateResolved` is false.
   */
  baseProjected: number;
  baseActual: number;
  /** False when no rate could be resolved, so totals using this item are approximate. */
  rateResolved: boolean;
};

export type Income = {
  projected: number;
  actual: number;
};

export type CategoryWithItems = Category & {
  items: LineItem[];
};

export type Budget = {
  income: Income;
  categories: CategoryWithItems[];
};

export type CategoryTotal = {
  id: number;
  name: string;
  icon: string;
  projected: number;
  actual: number;
};

export type DeltaRow = {
  id: number;
  name: string;
  icon: string;
  currentActual: number;
  prevActual: number;
  delta: number; // currentActual - prevActual, rounded to cents
};

export type MonthDelta =
  | { hasPrior: false }
  | { hasPrior: true; rows: DeltaRow[] };

export type ExportRow = {
  month: string; // 'YYYY-MM-01'
  category: string;
  item: string;
  /** Native amounts, in `currency` — what was actually spent. */
  projected: number;
  actual: number;
  /** '' when the expense carries no currency of its own. */
  currency: string;
  /** Converted into the base currency, so a mixed-currency export still totals. */
  baseProjected: number;
  baseActual: number;
};

export type Attachment = {
  id: number;
  lineItemId: number;
  /** `{user_id}/{line_item_id}/{uuid}.{ext}` in the private `receipts` bucket. */
  storagePath: string;
  mimeType: string;
  byteSize: number;
  originalName: string;
};
