import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  dueOn: null,
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

    // A USD expense under a USD base has nothing to convert and nothing to
    // override, so the whole strip is noise on every row.
    it('shows no rate override when the currency matches the base currency', () => {
      renderRow({ item: { ...baseItem, currency: 'USD' }, base: 'USD' });
      expect(screen.queryByLabelText('Rate override')).toBeNull();
      expect(screen.queryByTestId('converted-42')).toBeNull();
    });

    it('still shows the override when the currency differs from the base', () => {
      renderRow({ item: { ...baseItem, currency: 'USD' }, base: 'EUR' });
      expect(screen.getByLabelText('Rate override')).toBeInTheDocument();
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

    // Regression: the converted fields are computed server-side in getBudget, so
    // a local edit must recompute them or the row and every total stay stale.
    it('recomputes the converted amount as soon as a currency is chosen', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <table><tbody>
          <LineItemRow
            item={{ ...baseItem, projected: 30000, actual: 30000, baseProjected: 30000, baseActual: 30000 }}
            isConfirming={false}
            onConfirmRequest={vi.fn()}
            onChange={onChange}
            onDelete={vi.fn()}
            base="USD"
            rates={[{ currency: 'VES', rateDate: '2020-01-01', unitsPerUsd: 750, source: 'bcv' }]}
          />
        </tbody></table>,
      );
      await user.selectOptions(screen.getByLabelText('Currency'), 'VES');
      // 30,000 Bs at 750 Bs/$ = $40
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'VES', baseProjected: 40, rateResolved: true }),
      ));
    });

    it('marks the item unresolved when the chosen currency has no rate', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <table><tbody>
          <LineItemRow
            item={baseItem}
            isConfirming={false}
            onConfirmRequest={vi.fn()}
            onChange={onChange}
            onDelete={vi.fn()}
            base="USD"
            rates={[]}
          />
        </tbody></table>,
      );
      await user.selectOptions(screen.getByLabelText('Currency'), 'VES');
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'VES', rateResolved: false }),
      ));
    });

    it('flags an item whose rate could not be resolved', () => {
      renderRow({ item: { ...baseItem, currency: 'VES', rateResolved: false } });
      expect(screen.getByTestId('rate-unresolved-42')).toBeInTheDocument();
    });
  });

  describe('due date', () => {
    const dueItem: LineItem = { ...baseItem, dueOn: '2026-09-01' };

    // A failing assertion inside a fake-timers test would otherwise leave fake
    // timers installed for every later test in the file, turning one red into
    // a cascade that hides the real cause.
    afterEach(() => { vi.useRealTimers(); });

    it('offers to set a due date when none is set', () => {
      renderRow();
      expect(screen.getByRole('button', { name: 'Set due date' })).toBeInTheDocument();
    });

    it('shows the due date when one is set', () => {
      renderRow({ item: dueItem });
      expect(screen.getByLabelText('Due date')).toHaveValue('2026-09-01');
    });

    it('saves an edited due date', async () => {
      const user = userEvent.setup();
      vi.mocked(api.updateLineItem).mockResolvedValue();
      const { onChange } = renderRow({ item: dueItem });
      const input = screen.getByLabelText('Due date');
      await user.clear(input);
      await user.type(input, '2026-09-05');
      await user.tab();
      await waitFor(() => {
        expect(api.updateLineItem).toHaveBeenCalledWith(42, { dueOn: '2026-09-05' });
      });
      expect(onChange).toHaveBeenCalledWith({ ...dueItem, dueOn: '2026-09-05' });
    });

    it('clears the due date', async () => {
      const user = userEvent.setup();
      vi.mocked(api.updateLineItem).mockResolvedValue();
      const { onChange } = renderRow({ item: dueItem });
      await user.click(screen.getByRole('button', { name: 'Clear due date' }));
      await waitFor(() => {
        expect(api.updateLineItem).toHaveBeenCalledWith(42, { dueOn: null });
      });
      expect(onChange).toHaveBeenCalledWith({ ...dueItem, dueOn: null });
    });

    it('reverts the due date when the update fails', async () => {
      const user = userEvent.setup();
      vi.mocked(api.updateLineItem).mockRejectedValue(new Error('network'));
      const { onChange } = renderRow({ item: dueItem });
      await user.click(screen.getByRole('button', { name: 'Clear due date' }));
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith(dueItem);
      });
    });

    it('tones an unpaid past-due row as overdue', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(2026, 7, 24, 9, 0)); // local 24 Aug 2026
      renderRow({ item: { ...baseItem, dueOn: '2026-08-01', paidOn: null } });
      expect(screen.getByLabelText('Due date').className).toContain('border-negative');
      vi.useRealTimers();
    });

    it('does not tone a paid row as overdue', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(2026, 7, 24, 9, 0));
      renderRow({ item: { ...baseItem, dueOn: '2026-08-01', paidOn: '2026-08-02' } });
      expect(screen.getByLabelText('Due date').className).not.toContain('border-negative');
      vi.useRealTimers();
    });
  });
});
