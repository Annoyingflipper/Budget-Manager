import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnresolvedRatesNotice from './UnresolvedRatesNotice';
import type { CategoryWithItems } from '../types';

function cat(flags: boolean[]): CategoryWithItems {
  return {
    id: 1, name: 'Cat', display_order: 1, icon: '',
    items: flags.map((resolved, idx) => ({
      id: idx, category_id: 1, name: `Item${idx}`,
      projected: 10, actual: 10, paidOn: null,
      currency: resolved ? null : ('VES' as const),
      rateUnitsPerUsd: null,
      baseProjected: 10, baseActual: 10,
      rateResolved: resolved,
    })),
  };
}

describe('UnresolvedRatesNotice', () => {
  it('renders nothing when every rate resolved', () => {
    const { container } = render(
      <UnresolvedRatesNotice categories={[cat([true, true])]} onOpenRates={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no items at all', () => {
    const { container } = render(
      <UnresolvedRatesNotice categories={[cat([])]} onOpenRates={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names how many expenses are affected', () => {
    render(<UnresolvedRatesNotice categories={[cat([false, false, true])]} onOpenRates={vi.fn()} />);
    expect(screen.getByTestId('unresolved-rates')).toHaveTextContent('2 expenses');
  });

  it('uses the singular form for one expense', () => {
    render(<UnresolvedRatesNotice categories={[cat([false, true])]} onOpenRates={vi.fn()} />);
    expect(screen.getByTestId('unresolved-rates')).toHaveTextContent('1 expense');
  });

  // The user must understand the totals are not wrong-by-accident.
  it('explains that those expenses are counted at face value', () => {
    render(<UnresolvedRatesNotice categories={[cat([false])]} onOpenRates={vi.fn()} />);
    expect(screen.getByTestId('unresolved-rates')).toHaveTextContent(/face value/i);
  });

  it('offers a way to go and set the rate', () => {
    const onOpenRates = vi.fn();
    render(<UnresolvedRatesNotice categories={[cat([false])]} onOpenRates={onOpenRates} />);
    fireEvent.click(screen.getByRole('button', { name: /set a rate/i }));
    expect(onOpenRates).toHaveBeenCalled();
  });

  it('counts across multiple categories', () => {
    render(
      <UnresolvedRatesNotice
        categories={[cat([false]), { ...cat([false, false]), id: 2 }]}
        onOpenRates={vi.fn()}
      />,
    );
    expect(screen.getByTestId('unresolved-rates')).toHaveTextContent('3 expenses');
  });
});
