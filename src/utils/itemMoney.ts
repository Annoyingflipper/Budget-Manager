import type { Currency } from './currency';
import { rateFor, type RateRow } from './rates';

type ConvertibleItem = {
  currency: Currency | null;
  paidOn: string | null;
  rateUnitsPerUsd: number | null;
};

/**
 * The date whose rate applies. A paid expense converts at the rate in force the
 * day it was paid; an unpaid one is an estimate at today's rate, because the
 * money has not actually moved yet.
 */
export function effectiveDate(paidOn: string | null, today: string): string {
  return paidOn ?? today;
}

/**
 * Units-per-USD for this item, or null if it cannot be resolved.
 *
 * Precedence: the per-expense override wins over the daily table — it exists
 * precisely for when the user transacted at a rate other than the official one.
 * A null currency means the amount is already in the base currency, so 1.
 */
export function itemRate(item: ConvertibleItem, rates: RateRow[], today: string): number | null {
  if (item.rateUnitsPerUsd !== null) return item.rateUnitsPerUsd;
  if (item.currency === null) return 1;
  return rateFor(rates, item.currency, effectiveDate(item.paidOn, today));
}

/** `amount` (in the item's currency) expressed in `base`. Null if unresolvable. */
export function convertAmount(
  amount: number,
  item: ConvertibleItem,
  base: Currency,
  rates: RateRow[],
  today: string,
): number | null {
  const from = itemRate(item, rates, today);
  if (from === null) return null;
  // An untagged item is already in the base currency by definition — converting
  // it again would double-count whenever the base is not USD.
  if (item.currency === null) return Math.round(amount * 100) / 100;
  const to = rateFor(rates, base, effectiveDate(item.paidOn, today));
  if (to === null) return null;
  return Math.round((amount * to / from) * 100) / 100;
}
