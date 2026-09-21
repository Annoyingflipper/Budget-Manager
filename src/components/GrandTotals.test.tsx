import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GrandTotals from './GrandTotals';
import type { CategoryWithItems } from '../types';

function category(
  id: number,
  name: string,
  items: Array<{ id: number; projected: number; actual: number; baseProjected?: number; baseActual?: number }>,
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
      baseProjected: i.baseProjected ?? i.projected,
      baseActual: i.baseActual ?? i.actual,
      rateResolved: true,
    })),
  };
}

describe('GrandTotals', () => {
  it('sums projected + actual across multiple categories with multiple items', () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', [
        { id: 1, projected: 20, actual: 20 },
        { id: 2, projected: 15, actual: 17 },
      ]),
      category(2, 'Loans', [{ id: 3, projected: 200, actual: 200 }]),
    ];
    render(<GrandTotals categories={categories} />);
    expect(screen.getByText('$235.00')).toBeInTheDocument(); // projected total
    expect(screen.getByText('$237.00')).toBeInTheDocument(); // actual total
    expect(screen.getByText('$2.00')).toBeInTheDocument();   // difference +2 over
  });

  it('renders zeros without crashing when all categories are empty', () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', []),
      category(2, 'Loans', []),
    ];
    render(<GrandTotals categories={categories} />);
    expect(screen.getAllByText('$0.00').length).toBeGreaterThanOrEqual(3);
  });

  // text-*-on-hero, not text-negative/text-positive: this section renders on
  // --hero-bg, and neither --negative nor --positive clears 4.5:1 there (see
  // src/theme/tokens.test.ts's "on --hero-bg" suite) — a regression the
  // v2.2 chunk 1 fix wave caught and corrected.
  it('applies text-negative-on-hero color when total difference is positive (over budget)', () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', [{ id: 1, projected: 10, actual: 25 }]),
    ];
    render(<GrandTotals categories={categories} />);
    const diffCell = screen.getByText('$15.00');
    expect(diffCell).toHaveClass('text-negative-on-hero');
  });

  it('applies text-positive-on-hero color when total difference is negative (under budget)', () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', [{ id: 1, projected: 25, actual: 10 }]),
    ];
    render(<GrandTotals categories={categories} />);
    const diffCell = screen.getByText('-$15.00');
    expect(diffCell).toHaveClass('text-positive-on-hero');
  });

  // The whole point of chunk 2: an expense recorded in bolivares must contribute
  // its converted value to the totals, never its face number.
  it('totals the converted amounts, not the native ones', () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', [
        { id: 1, projected: 30000, actual: 30000, baseProjected: 50, baseActual: 50 },
        { id: 2, projected: 10, actual: 10 },
      ]),
    ];
    render(<GrandTotals categories={categories} />);
    expect(screen.getAllByText('$60.00').length).toBeGreaterThan(0);
  });

  // Shape assertions guarding a measured layout fix, not a re-derivation of the
  // measurement itself — jsdom has no layout engine, so it cannot see that the
  // figures overflow their columns. The actual scrollWidth/clientWidth numbers
  // that justify this change are recorded in the commit message for the fix
  // (checked live at 640/768/900/1024/1280px against the running app), not here.
  it("uses text-title for the totals, not text-display — GrandTotals is a footer, not a second hero", () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', [{ id: 1, projected: 20, actual: 25 }]),
    ];
    render(<GrandTotals categories={categories} />);
    expect(screen.getByText('$20.00', { selector: '.text-title' })).toBeInTheDocument();
    expect(screen.getByText('$25.00', { selector: '.text-title' })).toBeInTheDocument();
    expect(document.querySelector('.text-display')).toBeNull();
  });

  it('uses lg:grid-cols-3 rather than sm:grid-cols-3, so three columns never appear inside a main area narrower than they need', () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', [{ id: 1, projected: 20, actual: 20 }]),
    ];
    const { container } = render(<GrandTotals categories={categories} />);
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('lg:grid-cols-3');
    expect(grid?.className).not.toContain('sm:grid-cols-3');
  });
});
