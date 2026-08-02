import { describe, it, expect } from 'vitest';
import { effectiveDate, itemRate, convertAmount } from './itemMoney';
import type { RateRow } from './rates';
import type { Currency } from './currency';

const RATES: RateRow[] = [
  { currency: 'VES', rateDate: '2026-05-01', unitsPerUsd: 600, source: 'bcv' },
  { currency: 'VES', rateDate: '2026-08-01', unitsPerUsd: 750, source: 'bcv' },
  { currency: 'EUR', rateDate: '2026-08-01', unitsPerUsd: 0.87, source: 'ecb' },
];

const TODAY = '2026-08-02';

function item(
  over: Partial<{
    currency: Currency | null;
    paidOn: string | null;
    rateUnitsPerUsd: number | null;
  }> = {},
) {
  return { currency: null, paidOn: null, rateUnitsPerUsd: null, ...over };
}

describe('effectiveDate', () => {
  it('uses paidOn when the item is paid', () => {
    expect(effectiveDate('2026-05-01', TODAY)).toBe('2026-05-01');
  });

  it('falls back to today when unpaid — the money has not moved yet', () => {
    expect(effectiveDate(null, TODAY)).toBe(TODAY);
  });
});

describe('itemRate', () => {
  it('returns 1 when no currency is set (already in base currency)', () => {
    expect(itemRate(item(), RATES, TODAY)).toBe(1);
  });

  it('uses the rate in force on the paid date, not today', () => {
    expect(itemRate(item({ currency: 'VES', paidOn: '2026-05-01' }), RATES, TODAY)).toBe(600);
  });

  it('uses today for an unpaid item', () => {
    expect(itemRate(item({ currency: 'VES' }), RATES, TODAY)).toBe(750);
  });

  // The whole point of the override: official was 750, user changed at 800.
  it('prefers the per-expense override over the daily table', () => {
    expect(itemRate(item({ currency: 'VES', rateUnitsPerUsd: 800 }), RATES, TODAY)).toBe(800);
  });

  it('honours the override even when no table rate exists at all', () => {
    expect(itemRate(
      item({ currency: 'VES', paidOn: '2020-01-01', rateUnitsPerUsd: 50 }), RATES, TODAY,
    )).toBe(50);
  });

  it('returns null when the currency has no resolvable rate', () => {
    expect(itemRate(item({ currency: 'VES', paidOn: '2020-01-01' }), RATES, TODAY)).toBeNull();
  });

  it('returns 1 for a USD item regardless of rates', () => {
    expect(itemRate(item({ currency: 'USD', paidOn: '2020-01-01' }), [], TODAY)).toBe(1);
  });
});

describe('convertAmount', () => {
  it('passes an untagged amount straight through', () => {
    expect(convertAmount(100, item(), 'USD', RATES, TODAY)).toBe(100);
  });

  it('converts a bolivar amount at the paid-date rate', () => {
    // 30,000 Bs at 600 Bs/$ on 1 May = $50
    expect(convertAmount(
      30000, item({ currency: 'VES', paidOn: '2026-05-01' }), 'USD', RATES, TODAY,
    )).toBe(50);
  });

  it('uses the override rate when present', () => {
    // same 30,000 Bs but actually changed at 800 Bs/$ = $37.50
    expect(convertAmount(
      30000, item({ currency: 'VES', paidOn: '2026-05-01', rateUnitsPerUsd: 800 }), 'USD', RATES, TODAY,
    )).toBe(37.5);
  });

  it('converts into a non-USD base currency', () => {
    // 750 Bs -> $1 -> €0.87
    expect(convertAmount(750, item({ currency: 'VES' }), 'EUR', RATES, TODAY)).toBe(0.87);
  });

  it('returns null when the rate cannot be resolved', () => {
    expect(convertAmount(
      100, item({ currency: 'VES', paidOn: '2020-01-01' }), 'USD', RATES, TODAY,
    )).toBeNull();
  });

  it('returns null when the base currency rate is unknown', () => {
    expect(convertAmount(100, item({ currency: 'USD' }), 'EUR', [], TODAY)).toBeNull();
  });

  it('is unaffected by the base currency when no currency is set', () => {
    // An untagged amount is BY DEFINITION already in the base currency, so it
    // must not be double-converted when the base is not USD.
    expect(convertAmount(100, item(), 'EUR', RATES, TODAY)).toBe(100);
  });
});
