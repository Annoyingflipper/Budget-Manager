import { describe, it, expect } from 'vitest';
import { rateFor, convert, type RateRow } from './rates';

const ROWS: RateRow[] = [
  { currency: 'EUR', rateDate: '2026-04-30', unitsPerUsd: 0.85455, source: 'ecb' },
  { currency: 'EUR', rateDate: '2026-05-04', unitsPerUsd: 0.8547, source: 'ecb' },
  { currency: 'VES', rateDate: '2026-05-01', unitsPerUsd: 540, source: 'manual' },
  { currency: 'VES', rateDate: '2026-07-31', unitsPerUsd: 746.6297, source: 'bcv' },
];

describe('rateFor', () => {
  it('returns 1 for USD without consulting any rows', () => {
    expect(rateFor([], 'USD', '2026-05-01')).toBe(1);
  });

  it('returns the exact row when the date matches', () => {
    expect(rateFor(ROWS, 'VES', '2026-05-01')).toBe(540);
  });

  // The ECB does not publish on weekends or holidays, and the BCV rate is only
  // captured on days the app is opened, so gaps are normal, not exceptional.
  it('carries the most recent earlier rate forward across a gap', () => {
    expect(rateFor(ROWS, 'EUR', '2026-05-03')).toBe(0.85455);
  });

  it('carries forward across a long gap', () => {
    expect(rateFor(ROWS, 'VES', '2026-06-15')).toBe(540);
  });

  it('never looks forward in time', () => {
    expect(rateFor(ROWS, 'EUR', '2026-04-29')).toBeNull();
  });

  it('returns null when the currency has no rows at all', () => {
    expect(rateFor(
      [{ currency: 'EUR', rateDate: '2026-01-01', unitsPerUsd: 0.9, source: 'ecb' }],
      'VES', '2026-05-01',
    )).toBeNull();
  });

  it('is insensitive to row ordering', () => {
    const shuffled = [...ROWS].reverse();
    expect(rateFor(shuffled, 'EUR', '2026-05-05')).toBe(0.8547);
  });
});

describe('convert', () => {
  it('is the identity when from and to match', () => {
    expect(convert(100, 'USD', 'USD', ROWS, '2026-05-01')).toBe(100);
  });

  it('converts a foreign currency into USD', () => {
    // 30,000 Bs at 540 Bs/$ = $55.56
    expect(convert(30000, 'VES', 'USD', ROWS, '2026-05-01')).toBe(55.56);
  });

  it('converts USD into a foreign currency', () => {
    expect(convert(100, 'USD', 'VES', ROWS, '2026-05-01')).toBe(54000);
  });

  it('converts between two foreign currencies through USD', () => {
    // 540 Bs -> $1 -> €0.85455 (EUR carried forward from 2026-04-30)
    expect(convert(540, 'VES', 'EUR', ROWS, '2026-05-01')).toBe(0.85);
  });

  it('uses the rate in force on the given date, not the latest one', () => {
    // Same amount, later date, much weaker bolivar.
    expect(convert(30000, 'VES', 'USD', ROWS, '2026-07-31')).toBe(40.18);
  });

  it('returns null when the source rate is unknown', () => {
    expect(convert(100, 'VES', 'USD', ROWS, '2026-01-01')).toBeNull();
  });

  it('returns null when the target rate is unknown', () => {
    expect(convert(100, 'USD', 'EUR', ROWS, '2026-01-01')).toBeNull();
  });

  it('rounds to cents', () => {
    expect(convert(1, 'USD', 'EUR', ROWS, '2026-05-04')).toBe(0.85);
  });
});
