import { describe, it, expect } from 'vitest';
import { CURRENCIES, CURRENCY_CODES, formatCurrency } from './currency';

describe('CURRENCIES', () => {
  it('declares exactly USD, EUR, VES in that order', () => {
    expect(CURRENCY_CODES).toEqual(['USD', 'EUR', 'VES']);
  });

  it('gives every currency a symbol and a label', () => {
    for (const code of CURRENCY_CODES) {
      expect(CURRENCIES[code].symbol).toBeTruthy();
      expect(CURRENCIES[code].label).toBeTruthy();
    }
  });
});

describe('formatCurrency', () => {
  it('formats USD with Intl', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('formats EUR with Intl', () => {
    expect(formatCurrency(1234.5, 'EUR')).toBe('€1,234.50');
  });

  // Intl renders VES as "VES 1,234.50"; we want the familiar Bs. prefix.
  it('formats VES with a Bs. prefix rather than the ISO code', () => {
    expect(formatCurrency(1234.5, 'VES')).toBe('Bs. 1,234.50');
  });

  it('puts the minus sign before the symbol for negative USD', () => {
    expect(formatCurrency(-450, 'USD')).toBe('-$450.00');
  });

  it('puts the minus sign before the prefix for negative VES', () => {
    expect(formatCurrency(-450, 'VES')).toBe('-Bs. 450.00');
  });

  it('always shows two decimals', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    expect(formatCurrency(45000, 'VES')).toBe('Bs. 45,000.00');
  });
});
