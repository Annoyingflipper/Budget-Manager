import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportButtons from './ExportButtons';
import type { Budget } from '../types';

const downloadCsv = vi.fn();
vi.mock('../utils/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/csv')>()),
  downloadCsv: (...args: unknown[]) => downloadCsv(...args),
}));

const getExportRows = vi.fn();
vi.mock('../api/budget', () => ({
  getExportRows: () => getExportRows(),
}));

const budget: Budget = {
  income: { projected: 5000, actual: 5000 },
  categories: [
    {
      id: 1, name: 'Food', display_order: 0, icon: '🍔',
      items: [{ id: 11, category_id: 1, name: 'Groceries', projected: 400, actual: 450, paidOn: null, dueOn: null,
        currency: null, rateUnitsPerUsd: null, baseProjected: 400, baseActual: 450, rateResolved: true }],
    },
  ],
};

beforeEach(() => {
  downloadCsv.mockReset();
  getExportRows.mockReset();
});

describe('ExportButtons', () => {
  it('exports the current month from the in-memory budget', () => {
    render(<ExportButtons month="2026-06-01" budget={budget} />);
    fireEvent.click(screen.getByText('⤓ Export this month'));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = downloadCsv.mock.calls[0];
    expect(filename).toBe('budget-2026-06.csv');
    expect(csv).toContain('Month,Category,Item,Currency,Projected,Actual,Projected (USD),Actual (USD)');
    expect(csv).toContain('2026-06-01,Food,Groceries,,400.00,450.00,400.00,450.00');
  });

  it('exports all history via getExportRows', async () => {
    getExportRows.mockResolvedValue([
      { month: '2026-05-01', category: 'Rent', item: 'Apt', projected: 1650, actual: 1650,
        currency: 'VES', baseProjected: 2.2, baseActual: 2.2 },
    ]);
    render(<ExportButtons month="2026-06-01" budget={budget} />);
    fireEvent.click(screen.getByText('⤓ Export all history'));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
    const [filename, csv] = downloadCsv.mock.calls[0];
    expect(filename).toBe('budget-all-history.csv');
    // native amount and its converted value both present
    expect(csv).toContain('2026-05-01,Rent,Apt,VES,1650.00,1650.00,2.20,2.20');
  });
});
