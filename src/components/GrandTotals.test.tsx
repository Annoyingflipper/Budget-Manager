import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GrandTotals from './GrandTotals';
import type { CategoryWithItems } from '../types';

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

  it('applies text-negative color when total difference is positive (over budget)', () => {
    const categories: CategoryWithItems[] = [
      category(1, 'Services', [{ id: 1, projected: 10, actual: 25 }]),
    ];
    render(<GrandTotals categories={categories} />);
    const diffCell = screen.getByText('$15.00');
    expect(diffCell).toHaveClass('text-negative');
  });
});
