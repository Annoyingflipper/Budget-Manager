import type { Currency } from './currency';

export type RateSource = 'ecb' | 'bcv' | 'manual';

export type RateRow = {
  currency: Currency;
  rateDate: string; // ISO 'YYYY-MM-DD'
  unitsPerUsd: number;
  source: RateSource;
};

/**
 * The rate in force for `currency` on `date`, expressed as units per USD.
 *
 * Falls back to the most recent row strictly before `date` — the ECB does not
 * publish on weekends or holidays, and the BCV rate is only captured on days
 * the app is opened, so gaps are the norm.
 *
 * Returns null when nothing is known on or before that date. Callers must
 * surface that as "rate unknown"; treating it as 1 would silently invent money.
 */
export function rateFor(rows: RateRow[], currency: Currency, date: string): number | null {
  if (currency === 'USD') return 1;
  let best: RateRow | null = null;
  for (const row of rows) {
    if (row.currency !== currency) continue;
    if (row.rateDate > date) continue;
    if (!best || row.rateDate > best.rateDate) best = row;
  }
  return best ? best.unitsPerUsd : null;
}

/** Converts through USD, so any pair works from single-anchor rates. */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rows: RateRow[],
  date: string,
): number | null {
  const fromRate = rateFor(rows, from, date);
  const toRate = rateFor(rows, to, date);
  if (fromRate === null || toRate === null) return null;
  return Math.round(((amount * toRate) / fromRate) * 100) / 100;
}
