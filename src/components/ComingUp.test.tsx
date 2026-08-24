import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComingUp from './ComingUp';
import type { Account, CategoryWithItems, LineItem } from '../types';
import type { RateRow } from '../utils/rates';

function item(over: Partial<LineItem> = {}): LineItem {
  return {
    id: 1, category_id: 1, name: 'Rent', projected: 100, actual: 0,
    paidOn: null, dueOn: null, currency: null, rateUnitsPerUsd: null,
    baseProjected: 100, baseActual: 0, rateResolved: true, ...over,
  };
}

function cats(items: LineItem[]): CategoryWithItems[] {
  return [{ id: 1, name: 'Bills', display_order: 1, icon: '🧾', items }];
}

const USD_ACCOUNT: Account = {
  id: 1, name: 'Checking', icon: '🏦', currency: 'USD', balance: 2410, display_order: 1,
};
const NO_RATES: RateRow[] = [];
const MONTH = '2026-08-01';

beforeEach(() => {
  // shouldAdvanceTime: true (matching the pattern already used in
  // LineItemRow.test.tsx) — plain `vi.useFakeTimers()` combined with
  // `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` deadlocks
  // under this project's pinned Vitest 4 / user-event 14.5.2, reproducible
  // with a bare button click with no component code involved.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 24)); // 24 Aug 2026, local
});
afterEach(() => { vi.useRealTimers(); });

describe('ComingUp', () => {
  it('renders nothing when no item is both unpaid and dated', () => {
    const { container } = render(
      <ComingUp categories={cats([item()])} accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the selected month in the heading', () => {
    render(
      <ComingUp categories={cats([item({ dueOn: '2026-08-26', baseProjected: 845 })])}
        accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(screen.getByTestId('coming-up')).toHaveTextContent('Coming up — August 2026');
  });

  it('shows counts and totals for the three buckets', () => {
    render(
      <ComingUp
        categories={cats([
          item({ id: 1, dueOn: '2026-08-20', baseProjected: 310 }),
          item({ id: 2, dueOn: '2026-08-26', baseProjected: 845 }),
          item({ id: 3, dueOn: '2026-09-15', baseProjected: 90 }),
        ])}
        accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH}
      />,
    );
    expect(screen.getByTestId('bucket-overdue')).toHaveTextContent('1 item');
    expect(screen.getByTestId('bucket-overdue')).toHaveTextContent('$310.00');
    expect(screen.getByTestId('bucket-dueSoon')).toHaveTextContent('$845.00');
    expect(screen.getByTestId('bucket-later')).toHaveTextContent('$90.00');
  });

  it('omits a bucket that has no items', () => {
    render(
      <ComingUp categories={cats([item({ dueOn: '2026-08-26', baseProjected: 845 })])}
        accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(screen.queryByTestId('bucket-overdue')).not.toBeInTheDocument();
    expect(screen.getByTestId('bucket-dueSoon')).toBeInTheDocument();
  });

  it('expands a bucket to list its items', async () => {
    const user = userEvent.setup();
    render(
      <ComingUp categories={cats([item({ name: 'Electric', dueOn: '2026-08-20', baseProjected: 310 })])}
        accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(screen.queryByText('Electric')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('bucket-overdue'));
    expect(screen.getByText('Electric')).toBeInTheDocument();
  });

  it('says covered when the accounts hold enough', () => {
    render(
      <ComingUp categories={cats([item({ dueOn: '2026-08-26', baseProjected: 845 })])}
        accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(screen.getByTestId('cashflow-verdict')).toHaveTextContent('✓ Covered');
    expect(screen.getByTestId('cashflow-verdict')).not.toHaveTextContent('dated bills only');
  });

  it('reports the shortfall when they do not', () => {
    render(
      <ComingUp categories={cats([item({ dueOn: '2026-08-26', baseProjected: 3000 })])}
        accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(screen.getByTestId('cashflow-verdict')).toHaveTextContent('Short by $590.00');
  });

  it('excludes the later bucket from the verdict', () => {
    // 845 due soon, 3000 later. Available 2410 — covered, because "later" does not count.
    render(
      <ComingUp
        categories={cats([
          item({ id: 1, dueOn: '2026-08-26', baseProjected: 845 }),
          item({ id: 2, dueOn: '2026-10-01', baseProjected: 3000 }),
        ])}
        accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH}
      />,
    );
    expect(screen.getByTestId('cashflow-verdict')).toHaveTextContent('Covered');
  });

  it('asks for a rate instead of guessing when the total is unknown', () => {
    const ves: Account = {
      id: 2, name: 'Bs', icon: '💵', currency: 'VES', balance: 100000, display_order: 2,
    };
    render(
      <ComingUp categories={cats([item({ dueOn: '2026-08-26', baseProjected: 845 })])}
        accounts={[USD_ACCOUNT, ves]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(screen.getByTestId('cashflow-verdict')).toHaveTextContent('Set an exchange rate');
  });

  it('omits the verdict entirely when there are no accounts', () => {
    render(
      <ComingUp categories={cats([item({ dueOn: '2026-08-26', baseProjected: 845 })])}
        accounts={[]} rates={NO_RATES} base="USD" month={MONTH} />,
    );
    expect(screen.queryByTestId('cashflow-verdict')).not.toBeInTheDocument();
  });

  describe('undated unpaid items', () => {
    it('shows how many unpaid items have no due date set', () => {
      render(
        <ComingUp
          categories={cats([
            item({ id: 1, dueOn: '2026-08-26', baseProjected: 845 }),
            item({ id: 2, dueOn: null, baseProjected: 50 }),
            item({ id: 3, dueOn: null, baseProjected: 60 }),
          ])}
          accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH}
        />,
      );
      expect(screen.getByTestId('undated-count')).toHaveTextContent('2 more unpaid, no due date set');
    });

    it('does not show the undated line when every unpaid item is dated', () => {
      render(
        <ComingUp categories={cats([item({ dueOn: '2026-08-26', baseProjected: 845 })])}
          accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH} />,
      );
      expect(screen.queryByTestId('undated-count')).not.toBeInTheDocument();
    });

    it('qualifies the "Covered" verdict only when undated bills exist', () => {
      render(
        <ComingUp
          categories={cats([
            item({ id: 1, dueOn: '2026-08-26', baseProjected: 845 }),
            item({ id: 2, dueOn: null, baseProjected: 50 }),
          ])}
          accounts={[USD_ACCOUNT]} rates={NO_RATES} base="USD" month={MONTH}
        />,
      );
      expect(screen.getByTestId('cashflow-verdict')).toHaveTextContent('✓ Covered — dated bills only');
    });
  });
});
