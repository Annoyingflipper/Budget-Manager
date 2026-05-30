import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryRow from './CategoryRow';
import * as api from '../api/categories';
import type { Category } from '../types';

vi.mock('../api/categories');

const baseCategory: Category = {
  id: 42,
  name: 'Services',
  display_order: 1,
  icon: '🛠',
};

function setup(category: Category = baseCategory) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  render(<CategoryRow category={category} onChange={onChange} onDelete={onDelete} />);
  return { onChange, onDelete };
}

beforeEach(() => { vi.resetAllMocks(); });

describe('CategoryRow', () => {
  it('blur on name input with a new value calls renameCategory and onChange', async () => {
    const user = userEvent.setup();
    vi.mocked(api.renameCategory).mockResolvedValue();
    const { onChange } = setup();
    const input = screen.getByDisplayValue('Services');
    await user.clear(input);
    await user.type(input, 'Mortgage');
    await user.tab();
    await waitFor(() => {
      expect(api.renameCategory).toHaveBeenCalledWith(42, 'Mortgage');
      expect(onChange).toHaveBeenCalledWith({ ...baseCategory, name: 'Mortgage' });
    });
  });

  it('blur with empty input reverts to original and does not call renameCategory', async () => {
    const user = userEvent.setup();
    vi.mocked(api.renameCategory).mockResolvedValue();
    setup();
    const input = screen.getByDisplayValue('Services');
    await user.clear(input);
    await user.tab();
    expect(api.renameCategory).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Services')).toBeInTheDocument();
  });

  it('clicking the delete button calls onDelete with the category', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();
    await user.click(screen.getByRole('button', { name: /delete services/i }));
    expect(onDelete).toHaveBeenCalledWith(baseCategory);
  });
});
