import { describe, it, expect } from 'vitest';
import { balanceNarrative, difference, differenceClass, formatMoney, sum } from './money';

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
  it('returns text-muted for zero on income', () => {
    expect(differenceClass('income', 0)).toBe('text-muted');
  });
  it('returns text-muted for zero on cost', () => {
    expect(differenceClass('cost', 0)).toBe('text-muted');
  });
  it('returns text-positive when income positive', () => {
    expect(differenceClass('income', 50)).toBe('text-positive');
  });
  it('returns text-negative when income negative', () => {
    expect(differenceClass('income', -50)).toBe('text-negative');
  });
  it('returns text-negative when cost positive (over budget)', () => {
    expect(differenceClass('cost', 50)).toBe('text-negative');
  });
  it('returns text-positive when cost negative (under budget)', () => {
    expect(differenceClass('cost', -50)).toBe('text-positive');
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

describe('balanceNarrative', () => {
  const base = {
    projectedBalance: 1520, actualBalance: 1520,
    incomeProjected: 2000, incomeActual: 2000,
    costProjected: 480,   costActual: 480,
  };

  it('reports "right on projection" when balance, cost, and income all match', () => {
    expect(balanceNarrative(base)).toBe("You're right on projection.");
  });

  it('reports behind projection with both cost up and income down', () => {
    const args = {
      projectedBalance: 1500, actualBalance: 1345,
      incomeProjected: 2000, incomeActual: 1880,
      costProjected: 500,   costActual: 535,
    };
    expect(balanceNarrative(args)).toBe(
      "You're $155.00 behind projection — costs are up $35.00 and income is down $120.00."
    );
  });

  it('reports ahead of projection with cost down and income up', () => {
    const args = {
      projectedBalance: 1000, actualBalance: 1200,
      incomeProjected: 1500, incomeActual: 1600,
      costProjected: 500,   costActual: 400,
    };
    expect(balanceNarrative(args)).toBe(
      "You're $200.00 ahead of projection — costs are down $100.00 and income is up $100.00."
    );
  });

  it('reports behind with cost on budget and income down', () => {
    const args = {
      projectedBalance: 1000, actualBalance: 900,
      incomeProjected: 1500, incomeActual: 1400,
      costProjected: 500,   costActual: 500,
    };
    expect(balanceNarrative(args)).toBe(
      "You're $100.00 behind projection — costs are on budget and income is down $100.00."
    );
  });

  it('reports ahead with cost down and income on budget', () => {
    const args = {
      projectedBalance: 1000, actualBalance: 1050,
      incomeProjected: 1500, incomeActual: 1500,
      costProjected: 500,   costActual: 450,
    };
    expect(balanceNarrative(args)).toBe(
      "You're $50.00 ahead of projection — costs are down $50.00 and income is on budget."
    );
  });
});
