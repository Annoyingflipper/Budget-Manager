import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryTable from './CategoryTable';
import * as api from '../api/budget';
import type { CategoryWithItems, LineItem } from '../types';

vi.mock('../api/budget');

const baseCategory: CategoryWithItems = {
  id: 1,
  name: 'Services',
  display_order: 1,
  icon: '🛠',
  items: [],
};

const claudeItem: LineItem = {
  id: 100,
  category_id: 1,
  name: 'Claude',
  projected: 20,
  actual: 20,
  paidOn: null,
};

function setup(category: CategoryWithItems = baseCategory, periodMonth = '2026-06-01') {
  const onCategoryChange = vi.fn();
  render(
    <CategoryTable
      category={category}
      periodMonth={periodMonth}
      onCategoryChange={onCategoryChange}
    />,
  );
  return { onCategoryChange };
}

beforeEach(() => { vi.resetAllMocks(); });

describe('CategoryTable', () => {
  it('renders EmptyCategoryCard when no items and not drafting', () => {
    setup();
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add first/i })).toBeInTheDocument();
  });

  it('renders the table layout when items exist', () => {
    setup({ ...baseCategory, items: [claudeItem] });
    expect(screen.getByDisplayValue('Claude')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
  });

  it('+ Add item opens a draft row with a name input visible', async () => {
    const user = userEvent.setup();
    setup({ ...baseCategory, items: [claudeItem] });
    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByPlaceholderText('Item name')).toBeInTheDocument();
  });

  it('typing name + projected + actual and tabbing away calls addLineItem with periodMonth and onCategoryChange', async () => {
    const user = userEvent.setup();
    vi.mocked(api.addLineItem).mockResolvedValue({
      id: 200,
      category_id: 1,
      name: 'Netflix',
      projected: 15,
      actual: 17,
      paidOn: null,
    });
    const { onCategoryChange } = setup({ ...baseCategory, items: [claudeItem] });
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.type(screen.getByPlaceholderText('Item name'), 'Netflix');
    await user.tab();
    await user.clear(screen.getByLabelText('Projected'));
    await user.type(screen.getByLabelText('Projected'), '15');
    await user.tab();
    await user.clear(screen.getByLabelText('Actual'));
    await user.type(screen.getByLabelText('Actual'), '17');
    await user.tab();
    await waitFor(() => {
      expect(api.addLineItem).toHaveBeenCalledWith('2026-06-01', 1, {
        name: 'Netflix',
        projected: 15,
        actual: 17,
      });
      expect(onCategoryChange).toHaveBeenCalled();
    });
  });

  it('pressing Escape on the draft row discards it without an API call', async () => {
    const user = userEvent.setup();
    setup({ ...baseCategory, items: [claudeItem] });
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.type(screen.getByPlaceholderText('Item name'), 'Half');
    await user.keyboard('{Escape}');
    expect(api.addLineItem).not.toHaveBeenCalled();
  });

  it('renders a budget-health bar reflecting the category subtotal', () => {
    setup({
      ...baseCategory,
      items: [
        { id: 200, category_id: 1, name: 'Internet', projected: 80, actual: 85, paidOn: null },
        { id: 201, category_id: 1, name: 'Phone', projected: 50, actual: 50, paidOn: null },
      ],
    });
    const bar = screen.getByRole('progressbar');
    // subtotal: projected 130, actual 135 -> over by 5
    expect(bar).toHaveAttribute('data-state', 'over');
    expect(bar).toHaveAttribute('aria-label', 'Services budget: over by $5.00');
  });

  it('only one row at a time is in confirm state (click delete on row B clears row A)', async () => {
    const user = userEvent.setup();
    const itemA: LineItem = { id: 100, category_id: 1, name: 'A', projected: 1, actual: 1, paidOn: null };
    const itemB: LineItem = { id: 101, category_id: 1, name: 'B', projected: 2, actual: 2, paidOn: null };
    setup({ ...baseCategory, items: [itemA, itemB] });
    // Two delete buttons visible initially.
    const deleteButtons = screen.getAllByLabelText('Delete row');
    expect(deleteButtons).toHaveLength(2);
    // Click A's delete -> A turns into Confirm, B stays as Delete.
    await user.click(deleteButtons[0]);
    expect(screen.getAllByLabelText('Confirm delete')).toHaveLength(1);
    expect(screen.getAllByLabelText('Delete row')).toHaveLength(1);
    // Click B's delete -> B turns into Confirm, A goes back to Delete.
    await user.click(screen.getByLabelText('Delete row'));
    expect(screen.getAllByLabelText('Confirm delete')).toHaveLength(1);
    expect(screen.getAllByLabelText('Delete row')).toHaveLength(1);
    // Sanity check: row B is the confirming one (it has the projected value 2).
    expect(screen.getAllByDisplayValue('2').length).toBeGreaterThan(0);
  });
});
