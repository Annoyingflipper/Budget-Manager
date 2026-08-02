import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TotalAvailable from './TotalAvailable';
import type { Account } from '../types';
import type { RateRow } from '../utils/rates';

const RATES: RateRow[] = [
  { currency: 'EUR', rateDate: '2026-08-01', unitsPerUsd: 0.8707, source: 'ecb' },
  { currency: 'VES', rateDate: '2026-08-01', unitsPerUsd: 746.6297, source: 'bcv' },
];

const ACCOUNTS: Account[] = [
  { id: 1, name: 'Chase', icon: '🏦', currency: 'USD', balance: 2550.18, display_order: 1 },
  { id: 2, name: 'Revolut', icon: '💳', currency: 'EUR', balance: 1800, display_order: 2 },
];

describe('TotalAvailable (full)', () => {
  it('lists a subtotal per currency', () => {
    render(<TotalAvailable accounts={ACCOUNTS} rates={RATES} base="USD" date="2026-08-01" />);
    expect(screen.getByTestId('subtotal-USD')).toHaveTextContent('$2,550.18');
    expect(screen.getByTestId('subtotal-EUR')).toHaveTextContent('€1,800.00');
  });

  it('shows the grand total in the base currency', () => {
    render(<TotalAvailable accounts={ACCOUNTS} rates={RATES} base="USD" date="2026-08-01" />);
    // 2550.18 + 1800/0.8707 (2067.30) = 4617.48
    expect(screen.getByTestId('grand-total')).toHaveTextContent('$4,617.48');
  });

  // Never show a number derived from a rate we do not have.
  it('shows a rate-unknown message instead of a total when a rate is missing', () => {
    render(<TotalAvailable accounts={ACCOUNTS} rates={[]} base="USD" date="2026-08-01" />);
    expect(screen.queryByTestId('grand-total')).toBeNull();
    expect(screen.getByTestId('total-unavailable')).toHaveTextContent(/rate/i);
  });

  it('still shows per-currency subtotals when the grand total is unavailable', () => {
    render(<TotalAvailable accounts={ACCOUNTS} rates={[]} base="USD" date="2026-08-01" />);
    expect(screen.getByTestId('subtotal-EUR')).toHaveTextContent('€1,800.00');
  });

  it('renders an empty state when there are no accounts', () => {
    render(<TotalAvailable accounts={[]} rates={RATES} base="USD" date="2026-08-01" />);
    expect(screen.getByTestId('accounts-empty')).toBeInTheDocument();
  });
});

describe('TotalAvailable (compact)', () => {
  it('shows the total and the account count', () => {
    render(<TotalAvailable accounts={ACCOUNTS} rates={RATES} base="USD" date="2026-08-01"
      compact onOpen={vi.fn()} />);
    expect(screen.getByTestId('grand-total')).toHaveTextContent('$4,617.48');
    expect(screen.getByTestId('total-available-card')).toHaveTextContent('2 accounts');
  });

  it('uses the singular form for one account', () => {
    render(<TotalAvailable accounts={[ACCOUNTS[0]]} rates={RATES} base="USD" date="2026-08-01"
      compact onOpen={vi.fn()} />);
    expect(screen.getByTestId('total-available-card')).toHaveTextContent('1 account');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<TotalAvailable accounts={ACCOUNTS} rates={RATES} base="USD" date="2026-08-01"
      compact onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('total-available-card'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('renders nothing at all when there are no accounts', () => {
    const { container } = render(<TotalAvailable accounts={[]} rates={RATES} base="USD"
      date="2026-08-01" compact onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not omit accounts from the count when the total is unavailable', () => {
    render(<TotalAvailable accounts={ACCOUNTS} rates={[]} base="USD" date="2026-08-01"
      compact onOpen={vi.fn()} />);
    expect(screen.getByTestId('total-available-card')).toHaveTextContent('2 accounts');
    expect(screen.getByTestId('total-unavailable')).toBeInTheDocument();
  });
});
