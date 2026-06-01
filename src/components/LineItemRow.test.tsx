import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LineItemRow from './LineItemRow';
import * as api from '../api/budget';
import type { LineItem } from '../types';

vi.mock('../api/budget');

const baseItem: LineItem = {
  id: 42,
  category_id: 1,
  name: 'Netflix',
  projected: 15,
  actual: 17,
};

function renderRow(props: Partial<React.ComponentProps<typeof LineItemRow>> = {}) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  const onConfirmRequest = vi.fn();
  render(
    <table>
      <tbody>
        <LineItemRow
          item={baseItem}
          isConfirming={false}
          onConfirmRequest={onConfirmRequest}
          onChange={onChange}
          onDelete={onDelete}
          {...props}
        />
      </tbody>
    </table>
  );
  return { onChange, onDelete, onConfirmRequest };
}

beforeEach(() => { vi.resetAllMocks(); });

describe('LineItemRow', () => {
  it('calls updateLineItem on projected blur-sm with new value', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateLineItem).mockResolvedValue();
    renderRow();
    const projected = screen.getByDisplayValue('15');
    await user.clear(projected);
    await user.type(projected, '20');
    await user.tab();
    await waitFor(() => {
      expect(api.updateLineItem).toHaveBeenCalledWith(42, { projected: 20 });
    });
  });

  it('does not call updateLineItem when value is unchanged', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateLineItem).mockResolvedValue();
    renderRow();
    const projected = screen.getByDisplayValue('15');
    await user.click(projected);
    await user.tab();
    expect(api.updateLineItem).not.toHaveBeenCalled();
  });

  it('reverts via onChange when update fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateLineItem).mockRejectedValue(new Error('network'));
    const { onChange } = renderRow();
    const projected = screen.getByDisplayValue('15');
    await user.clear(projected);
    await user.type(projected, '99');
    await user.tab();
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(baseItem);
    });
  });

  it('isConfirming=false renders Delete button that calls onConfirmRequest, no API call', async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteLineItem).mockResolvedValue();
    const { onConfirmRequest } = renderRow({ isConfirming: false });
    await user.click(screen.getByLabelText('Delete row'));
    expect(onConfirmRequest).toHaveBeenCalledTimes(1);
    expect(api.deleteLineItem).not.toHaveBeenCalled();
  });

  it('isConfirming=true renders Confirm button that calls onDelete and deleteLineItem', async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteLineItem).mockResolvedValue();
    const { onDelete } = renderRow({ isConfirming: true });
    await user.click(screen.getByLabelText('Confirm delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(api.deleteLineItem).toHaveBeenCalledWith(42);
    });
  });
});
