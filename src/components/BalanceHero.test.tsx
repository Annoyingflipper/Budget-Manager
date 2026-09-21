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

  // Shape assertion pinning a coupling jsdom cannot see: the breakpoint the
  // two balances split at depends on how wide the figures are.
  //
  // At text-display (40px) they did not fit. $4,840.00 rendered 189px wide in
  // the 160px column a 640px viewport leaves once the sidebar appears, with no
  // overflow-hidden and no break opportunity, so the figures painted over each
  // other — which is why this briefly used lg:grid-cols-2 instead.
  //
  // At text-title (24px) they fit with real slack. Measured live in that same
  // 160px column: $711.00 is 93px, $4,840.00 is 113px, $14,840.00 is 128px,
  // and even -$123,456.78 is 152px. So sm: is correct again and the hero does
  // not need to stack on every window narrower than 1024px.
  //
  // If the figures ever go back up to text-display, this pairing has to go
  // back to lg: with it. That is the whole reason this test exists.
  it('splits at sm:, which is only safe because the figures are text-title', () => {
    const categories = [category(1, 'Services', [{ id: 1, projected: 160, actual: 160 }])];
    const { container } = render(<BalanceHero income={INCOME} categories={categories} />);
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('sm:grid-cols-2');
    expect(screen.getByTestId('projected-balance').className).toContain('text-title');
    expect(screen.getByTestId('projected-balance').className).not.toContain('text-display');
  });
});
