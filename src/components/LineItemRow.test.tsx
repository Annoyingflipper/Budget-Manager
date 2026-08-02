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
  paidOn: null,
  currency: null,
  rateUnitsPerUsd: null,
  baseProjected: 15,
  baseActual: 17,
  rateResolved: true,
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

  const paidItem: LineItem = { ...baseItem, paidOn: '2026-06-10' };

  it('Mark paid stamps today and calls updateLineItem with paidOn', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 5, 13, 9, 0)); // local June 13 2026
    const user = userEvent.setup();
    vi.mocked(api.updateLineItem).mockResolvedValue();
    const { onChange } = renderRow();
    await user.click(screen.getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => {
      expect(api.updateLineItem).toHaveBeenCalledWith(42, { paidOn: '2026-06-13' });
    });
    expect(onChange).toHaveBeenCalledWith({ ...baseItem, paidOn: '2026-06-13' });
    vi.useRealTimers();
  });

  it('reverts paid state when the mark-paid update fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateLineItem).mockRejectedValue(new Error('network'));
    const { onChange } = renderRow();
    await user.click(screen.getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(baseItem);
    });
  });

  it('clicking the paid check un-pays the item (paidOn: null)', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateLineItem).mockResolvedValue();
    const { onChange } = renderRow({ item: paidItem });
    await user.click(screen.getByRole('button', { name: 'Mark unpaid' }));
    await waitFor(() => {
      expect(api.updateLineItem).toHaveBeenCalledWith(42, { paidOn: null });
    });
    expect(onChange).toHaveBeenCalledWith({ ...paidItem, paidOn: null });
  });

  it('editing the date saves the new paidOn', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateLineItem).mockResolvedValue();
    const { onChange } = renderRow({ item: paidItem });
    const dateInput = screen.getByLabelText('Paid date');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-06-20');
    await user.tab();
    await waitFor(() => {
      expect(api.updateLineItem).toHaveBeenCalledWith(42, { paidOn: '2026-06-20' });
    });
    expect(onChange).toHaveBeenCalledWith({ ...paidItem, paidOn: '2026-06-20' });
  });

  describe('per-expense currency', () => {
    it('has no currency set by default', () => {
      renderRow();
      expect(screen.getByLabelText('Currency')).toHaveValue('');
    });

    it('sets a currency on the item', async () => {
      const user = userEvent.setup();
      renderRow();
      await user.selectOptions(screen.getByLabelText('Currency'), 'VES');
      await waitFor(() =>
        expect(api.updateLineItem).toHaveBeenCalledWith(42, { currency: 'VES' }));
    });

    it('clears the currency back to none', async () => {
      const user = userEvent.setup();
      renderRow({ item: { ...baseItem, currency: 'VES' } });
      await user.selectOptions(screen.getByLabelText('Currency'), '');
      await waitFor(() =>
        expect(api.updateLineItem).toHaveBeenCalledWith(42, { currency: null }));
    });

    it('shows the converted amount for a foreign-currency expense', () => {
      renderRow({ item: {
        ...baseItem, currency: 'VES', projected: 30000, actual: 30000,
        baseProjected: 50, baseActual: 50,
      } });
      expect(screen.getByTestId('converted-42')).toHaveTextContent('$50.00');
    });

    it('shows no converted figure when no currency is set', () => {
      renderRow();
      expect(screen.queryByTestId('converted-42')).toBeNull();
    });

    it('saves a rate override typed in the natural direction', async () => {
      const user = userEvent.setup();
      renderRow({ item: { ...baseItem, currency: 'VES' } });
      const input = screen.getByLabelText('Rate override');
      await user.type(input, '800');
      await user.tab();
      await waitFor(() =>
        expect(api.updateLineItem).toHaveBeenCalledWith(42, { rateUnitsPerUsd: 800 }));
    });

    it('clearing the override falls back to the official rate', async () => {
      const user = userEvent.setup();
      renderRow({ item: { ...baseItem, currency: 'VES', rateUnitsPerUsd: 800 } });
      const input = screen.getByLabelText('Rate override');
      await user.clear(input);
      await user.tab();
      await waitFor(() =>
        expect(api.updateLineItem).toHaveBeenCalledWith(42, { rateUnitsPerUsd: null }));
    });

    it('rejects a zero or negative override', async () => {
      const user = userEvent.setup();
      renderRow({ item: { ...baseItem, currency: 'VES' } });
      const input = screen.getByLabelText('Rate override');
      await user.type(input, '0');
      await user.tab();
      await waitFor(() => expect(screen.getByLabelText('Rate override')).toHaveValue(null));
      expect(api.updateLineItem).not.toHaveBeenCalled();
    });

    it('marks an item that used an override', () => {
      renderRow({ item: { ...baseItem, currency: 'VES', rateUnitsPerUsd: 800 } });
      expect(screen.getByTestId('rate-overridden-42')).toBeInTheDocument();
    });

    it('flags an item whose rate could not be resolved', () => {
      renderRow({ item: { ...baseItem, currency: 'VES', rateResolved: false } });
      expect(screen.getByTestId('rate-unresolved-42')).toBeInTheDocument();
    });
  });
});
