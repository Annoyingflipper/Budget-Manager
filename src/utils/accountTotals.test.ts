import { describe, it, expect } from 'vitest';
import { subtotalsByCurrency, grandTotal } from './accountTotals';
import type { RateRow } from './rates';
import type { Account } from '../types';

function acct(id: number, currency: Account['currency'], balance: number): Account {
  return { id, name: `A${id}`, icon: '🏦', currency, balance, display_order: id };
}

const ROWS: RateRow[] = [
  { currency: 'EUR', rateDate: '2026-08-01', unitsPerUsd: 0.8707, source: 'ecb' },
  { currency: 'VES', rateDate: '2026-08-01', unitsPerUsd: 746.6297, source: 'bcv' },
];

describe('subtotalsByCurrency', () => {
  it('groups and sums per currency', () => {
    const result = subtotalsByCurrency([
      acct(1, 'USD', 2430.18), acct(2, 'USD', 120), acct(3, 'EUR', 1800),
    ]);
    expect(result).toEqual([
      { currency: 'USD', total: 2550.18, count: 2 },
      { currency: 'EUR', total: 1800, count: 1 },
    ]);
  });

  it('omits currencies with no accounts', () => {
    expect(subtotalsByCurrency([acct(1, 'EUR', 10)]).map((s) => s.currency)).toEqual(['EUR']);
  });

  it('orders groups by the CURRENCIES declaration, not by insertion', () => {
    const result = subtotalsByCurrency([acct(1, 'VES', 1), acct(2, 'USD', 1), acct(3, 'EUR', 1)]);
    expect(result.map((s) => s.currency)).toEqual(['USD', 'EUR', 'VES']);
  });

  it('sums negative balances, so a card reduces its subtotal', () => {
    expect(subtotalsByCurrency([acct(1, 'USD', 1000), acct(2, 'USD', -450)])[0].total).toBe(550);
  });

  it('returns an empty array for no accounts', () => {
    expect(subtotalsByCurrency([])).toEqual([]);
  });
});

describe('grandTotal', () => {
  it('sums a single-currency set without needing any rate', () => {
    expect(grandTotal([acct(1, 'USD', 100), acct(2, 'USD', 20)], 'USD', [], '2026-08-01')).toBe(120);
  });

  it('converts every currency into the base', () => {
    // $2550.18 + €1800/0.8707 ($2067.30) + Bs.45000/746.6297 ($60.27)
    const total = grandTotal(
      [acct(1, 'USD', 2550.18), acct(2, 'EUR', 1800), acct(3, 'VES', 45000)],
      'USD', ROWS, '2026-08-01',
    );
    expect(total).toBeCloseTo(4677.75, 2);
  });

  it('honours a non-USD base currency', () => {
    expect(grandTotal([acct(1, 'USD', 100)], 'EUR', ROWS, '2026-08-01')).toBe(87.07);
  });

  // A wrong total is worse than a visibly incomplete one.
  it('returns null when any account needs a rate that is unknown', () => {
    expect(grandTotal(
      [acct(1, 'USD', 100), acct(2, 'VES', 45000)],
      'USD', ROWS, '2026-01-01',
    )).toBeNull();
  });

  it('returns 0 for no accounts', () => {
    expect(grandTotal([], 'USD', ROWS, '2026-08-01')).toBe(0);
  });
});
