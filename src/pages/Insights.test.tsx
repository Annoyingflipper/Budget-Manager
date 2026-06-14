import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Insights from './Insights';
import type { Budget } from '../types';

const listMonths = vi.fn();
const getBudget = vi.fn();
vi.mock('../api/budget', () => ({
  listMonths: () => listMonths(),
  getBudget: (m: string) => getBudget(m),
  getExportRows: vi.fn(),
}));

const budget: Budget = {
  income: { projected: 5000, actual: 5000 },
  categories: [
    {
      id: 1, name: 'Food', display_order: 0, icon: '🍔',
      items: [{ id: 11, category_id: 1, name: 'Groceries', projected: 400, actual: 450, paidOn: null }],
    },
  ],
};

beforeEach(() => {
  listMonths.mockReset();
  getBudget.mockReset();
});

describe('Insights page', () => {
  it('renders the chart and a no-prior message when there is no previous month', async () => {
    listMonths.mockResolvedValue(['2026-06-01']); // no 2026-05-01
    render(<Insights selectedMonth="2026-06-01" budget={budget} onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.getByText('🍔 Food')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('No prior month to compare.')).toBeInTheDocument(),
    );
    expect(getBudget).not.toHaveBeenCalled();
  });

  it('treats an income-only prior month (no line items) as no prior month', async () => {
    listMonths.mockResolvedValue(['2026-06-01', '2026-05-01']);
    getBudget.mockResolvedValue({
      income: { projected: 4000, actual: 4000 },
      categories: [
        { id: 1, name: 'Food', display_order: 0, icon: '🍔', items: [] },
      ],
    });
    render(<Insights selectedMonth="2026-06-01" budget={budget} onBack={() => {}} />);

    await waitFor(() => expect(getBudget).toHaveBeenCalledWith('2026-05-01'));
    await waitFor(() =>
      expect(screen.getByText('No prior month to compare.')).toBeInTheDocument(),
    );
    expect(screen.queryByText('vs last month')).not.toBeInTheDocument();
  });

  it('fetches the previous month and shows a delta when prior data exists', async () => {
    listMonths.mockResolvedValue(['2026-06-01', '2026-05-01']);
    getBudget.mockResolvedValue({
      income: { projected: 5000, actual: 5000 },
      categories: [
        {
          id: 1, name: 'Food', display_order: 0, icon: '🍔',
          items: [{ id: 9, category_id: 1, name: 'Groceries', projected: 400, actual: 300, paidOn: null }],
        },
      ],
    });
    render(<Insights selectedMonth="2026-06-01" budget={budget} onBack={() => {}} />);

    await waitFor(() => expect(getBudget).toHaveBeenCalledWith('2026-05-01'));
    await waitFor(() => expect(screen.getByText('vs last month')).toBeInTheDocument());
  });
});
