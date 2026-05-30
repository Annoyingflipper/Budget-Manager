import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoriesEditor from './CategoriesEditor';
import * as api from '../api/categories';
import { supabase } from '../lib/supabase';
import type { Category } from '../types';

vi.mock('../api/categories');
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn(),
  },
}));

const cats: Category[] = [
  { id: 1, name: 'Services',      display_order: 1, icon: '🛠' },
  { id: 2, name: 'Entertainment', display_order: 2, icon: '🎬' },
  { id: 3, name: 'Loans',         display_order: 3, icon: '🏦' },
];

function builder(data: unknown) {
  // Thenable builder: chain calls return the same object; awaiting it resolves
  // to { data, error: null } so both `.select().eq().eq()` and `.select().eq().order()`
  // chains await cleanly.
  const b: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'order', 'delete'];
  for (const m of methods) {
    b[m] = (..._args: unknown[]) => b;
  }
  (b as { then: (resolve: (val: { data: unknown; error: null }) => void) => void }).then =
    (resolve) => resolve({ data, error: null });
  return b;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'categories') return builder(cats) as never;
    if (table === 'line_items') return builder([]) as never;
    return builder([]) as never;
  });
});

describe('CategoriesEditor', () => {
  it('renders every category once loaded', async () => {
    render(<CategoriesEditor />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Services')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Entertainment')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Loans')).toBeInTheDocument();
    });
  });

  it('clicking + Add category appends a draft row with empty name input visible', async () => {
    const user = userEvent.setup();
    render(<CategoriesEditor />);
    await screen.findByDisplayValue('Services');
    await user.click(screen.getByRole('button', { name: /add category/i }));
    expect(screen.getByPlaceholderText('New category name')).toBeInTheDocument();
  });

  it('dragging Loans onto Services calls reorderCategories with [3, 1, 2]', async () => {
    vi.mocked(api.reorderCategories).mockResolvedValue();
    render(<CategoriesEditor />);
    const servicesHandle = await screen.findByLabelText('Drag handle for Services');
    const loansHandle = screen.getByLabelText('Drag handle for Loans');
    fireEvent.dragStart(loansHandle, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } });
    fireEvent.dragOver(servicesHandle, { dataTransfer: { dropEffect: 'move' } });
    fireEvent.drop(servicesHandle, { dataTransfer: { getData: () => '3' } });
    await waitFor(() => {
      expect(api.reorderCategories).toHaveBeenCalledWith([3, 1, 2]);
    });
  });

  it('delete on a category with items shows the destination dropdown', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'categories') return builder(cats) as never;
      if (table === 'line_items') {
        return builder([{ id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }]) as never;
      }
      return builder([]) as never;
    });
    const user = userEvent.setup();
    render(<CategoriesEditor />);
    await screen.findByDisplayValue('Services');
    await user.click(screen.getByRole('button', { name: /delete services/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete services/i });
    expect(within(dialog).getByText(/4 items/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Move to')).toBeInTheDocument();
  });
});
