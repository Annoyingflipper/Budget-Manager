import { describe, it, expect } from 'vitest';
import { difference, differenceClass, formatMoney, sum } from './money';

describe('difference', () => {
  it('returns actual - projected', () => {
    expect(difference(100, 80)).toBe(20);
  });
  it('returns negative when under', () => {
    expect(difference(50, 80)).toBe(-30);
  });
  it('rounds to 2 decimal places to avoid floating point dust', () => {
    expect(difference(0.1 + 0.2, 0)).toBe(0.3);
  });
});

describe('differenceClass', () => {
  it('returns gray for zero on income', () => {
    expect(differenceClass('income', 0)).toBe('text-gray-500');
  });
  it('returns gray for zero on cost', () => {
    expect(differenceClass('cost', 0)).toBe('text-gray-500');
  });
  it('returns green when income positive (earned more than projected)', () => {
    expect(differenceClass('income', 50)).toBe('text-green-600');
  });
  it('returns red when income negative (earned less than projected)', () => {
    expect(differenceClass('income', -50)).toBe('text-red-600');
  });
  it('returns red when cost positive (over budget)', () => {
    expect(differenceClass('cost', 50)).toBe('text-red-600');
  });
  it('returns green when cost negative (under budget)', () => {
    expect(differenceClass('cost', -50)).toBe('text-green-600');
  });
});

describe('formatMoney', () => {
  it('formats positive as USD', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });
  it('formats negative as USD', () => {
    expect(formatMoney(-50)).toBe('-$50.00');
  });
  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });
});

describe('sum', () => {
  it('sums an empty list to 0', () => {
    expect(sum([])).toBe(0);
  });
  it('sums positive numbers', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
  it('handles floating point safely', () => {
    expect(sum([0.1, 0.2])).toBe(0.3);
  });
});
