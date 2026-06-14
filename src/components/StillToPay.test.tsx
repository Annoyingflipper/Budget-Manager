import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StillToPay from './StillToPay';
import type { CategoryWithItems } from '../types';

function cat(items: Array<{ projected: number; paidOn: string | null }>): CategoryWithItems {
  return {
    id: 1, name: 'Cat', display_order: 1, icon: '',
    items: items.map((i, idx) => ({
      id: idx, category_id: 1, name: `Item${idx}`,
      projected: i.projected, actual: 0, paidOn: i.paidOn,
    })),
  };
}

describe('StillToPay', () => {
  it('shows count + amount when items are unpaid', () => {
    render(<StillToPay categories={[cat([
      { projected: 100, paidOn: null },
      { projected: 20, paidOn: null },
      { projected: 5, paidOn: '2026-06-01' },
    ])]} />);
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('2 bills left');
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('$120.00');
  });

  it('shows the singular form for one unpaid bill', () => {
    render(<StillToPay categories={[cat([{ projected: 100, paidOn: null }])]} />);
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('1 bill left');
  });

  it('shows the all-paid state when nothing is outstanding', () => {
    render(<StillToPay categories={[cat([{ projected: 100, paidOn: '2026-06-02' }])]} />);
    expect(screen.getByTestId('still-to-pay')).toHaveTextContent('All paid this month');
  });

  it('renders nothing when there are no line items at all', () => {
    const { container } = render(<StillToPay categories={[cat([])]} />);
    expect(screen.queryByTestId('still-to-pay')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no categories', () => {
    render(<StillToPay categories={[]} />);
    expect(screen.queryByTestId('still-to-pay')).toBeNull();
  });
});
