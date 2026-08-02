import { CURRENCY_CODES, type Currency } from './currency';
import { convert, type RateRow } from './rates';
import type { Account } from '../types';

export type Subtotal = { currency: Currency; total: number; count: number };

/** One entry per currency that actually has accounts, in CURRENCIES order. */
export function subtotalsByCurrency(accounts: Account[]): Subtotal[] {
  const out: Subtotal[] = [];
  for (const currency of CURRENCY_CODES) {
    const mine = accounts.filter((a) => a.currency === currency);
    if (mine.length === 0) continue;
    const total = mine.reduce((sum, a) => sum + a.balance, 0);
    out.push({ currency, total: Math.round(total * 100) / 100, count: mine.length });
  }
  return out;
}

/**
 * Every balance converted into `base` and summed.
 * Null if any account's rate is unknown on that date — callers show
 * "rate unknown" rather than a total that quietly omits an account.
 */
export function grandTotal(
  accounts: Account[],
  base: Currency,
  rows: RateRow[],
  date: string,
): number | null {
  let total = 0;
  for (const account of accounts) {
    const converted = convert(account.balance, account.currency, base, rows, date);
    if (converted === null) return null;
    total += converted;
  }
  return Math.round(total * 100) / 100;
}
