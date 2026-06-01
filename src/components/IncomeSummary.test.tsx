import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncomeSummary from './IncomeSummary';
import * as api from '../api/budget';

vi.mock('../api/budget');

function setup(initial = { projected: 1500, actual: 1500 }, periodMonth = '2026-06-01') {
  const onChange = vi.fn();
  render(<IncomeSummary income={initial} periodMonth={periodMonth} onChange={onChange} />);
  return { onChange };
}

beforeEach(() => { vi.resetAllMocks(); });

describe('IncomeSummary', () => {
  it('calls updateIncome on Projected blur-sm with the new value and period', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateIncome).mockResolvedValue();
    setup();
    const projected = screen.getAllByDisplayValue('1500')[0];
    await user.clear(projected);
    await user.type(projected, '2000');
    await user.tab();
    await waitFor(() => {
      expect(api.updateIncome).toHaveBeenCalledWith('2026-06-01', { projected: 2000 });
    });
  });

  it('does not call updateIncome when value is unchanged on blur-sm', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateIncome).mockResolvedValue();
    setup();
    const projected = screen.getAllByDisplayValue('1500')[0];
    await user.click(projected);
    await user.tab();
    expect(api.updateIncome).not.toHaveBeenCalled();
  });

  it('reverts via onChange when updateIncome rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateIncome).mockRejectedValue(new Error('network'));
    const { onChange } = setup();
    const projected = screen.getAllByDisplayValue('1500')[0];
    await user.clear(projected);
    await user.type(projected, '9999');
    await user.tab();
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({ projected: 1500 });
    });
  });
});
