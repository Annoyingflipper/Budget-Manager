import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BalanceHero from './BalanceHero';
import type { CategoryWithItems, Income } from '../types';

function category(
  id: number,
  name: string,
  items: Array<{ id: number; projected: number; actual: number }>,
): CategoryWithItems {
  return {
    id,
    name,
    display_order: id,
    icon: '',
    items: items.map((i) => ({
      id: i.id,
      category_id: id,
      name: `Item${i.id}`,
      projected: i.projected,
      actual: i.actual,
      paidOn: null,
      dueOn: null,
      currency: null,
      rateUnitsPerUsd: null,
      baseProjected: i.projected,
      baseActual: i.actual,
      rateResolved: true,
    })),
  };
}

const INCOME: Income = { projected: 5000, actual: 5000 };

describe('BalanceHero', () => {
  it('shows the projected and actual balances', () => {
    const categories = [category(1, 'Services', [{ id: 1, projected: 160, actual: 160 }])];
    render(<BalanceHero income={INCOME} categories={categories} />);
    expect(screen.getByTestId('projected-balance')).toHaveTextContent('$4,840.00');
    expect(screen.getByTestId('actual-balance')).toHaveTextContent('$4,840.00');
  });

  // Shape assertion guarding a measured layout fix, not a re-derivation of the
  // measurement itself — jsdom has no layout engine, so it cannot see that
  // $4,840.00 (189px) overflows a 160px column at a 640px viewport once the
  // sidebar has appeared. The actual scrollWidth/clientWidth numbers that
  // justify this change are recorded in the commit message for the fix
  // (checked live at 640/768/900/1024/1280px against the running app).
  it('uses lg:grid-cols-2 rather than sm:grid-cols-2, so the two balances never appear inside a main area narrower than they need', () => {
    const categories = [category(1, 'Services', [{ id: 1, projected: 160, actual: 160 }])];
    const { container } = render(<BalanceHero income={INCOME} categories={categories} />);
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('lg:grid-cols-2');
    expect(grid?.className).not.toContain('sm:grid-cols-2');
  });
});
