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
  items: [],
};

const claudeItem: LineItem = {
  id: 100,
  category_id: 1,
  name: 'Claude',
  projected: 20,
  actual: 20,
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
});
