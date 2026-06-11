import { describe, it, expect } from 'vitest';
import { categoryBudgetStatus } from './budgetHealth';

describe('categoryBudgetStatus', () => {
  it('returns empty when both projected and actual are 0', () => {
    expect(categoryBudgetStatus(0, 0)).toEqual({ ratio: 0, state: 'empty', overBy: 0 });
  });

  it('returns under when actual is comfortably below projected', () => {
    expect(categoryBudgetStatus(100, 50)).toEqual({ ratio: 0.5, state: 'under', overBy: 0 });
  });

  it('returns near at exactly 90% of projected', () => {
    expect(categoryBudgetStatus(100, 90)).toEqual({ ratio: 0.9, state: 'near', overBy: 0 });
  });

  it('returns near when actual equals projected (at the limit)', () => {
    expect(categoryBudgetStatus(100, 100)).toEqual({ ratio: 1, state: 'near', overBy: 0 });
  });

  it('returns over and computes overBy when actual exceeds projected', () => {
    expect(categoryBudgetStatus(100, 135)).toEqual({ ratio: 1, state: 'over', overBy: 35 });
  });

  it('treats spend with no budget set (projected 0, actual > 0) as over', () => {
    expect(categoryBudgetStatus(0, 20)).toEqual({ ratio: 1, state: 'over', overBy: 20 });
  });

  it('rounds overBy to cents', () => {
    expect(categoryBudgetStatus(10, 10.005).overBy).toBe(0.01);
  });
});
