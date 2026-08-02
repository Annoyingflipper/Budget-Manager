import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const listAccounts = vi.fn();
const addAccount = vi.fn();
const updateAccount = vi.fn();
const deleteAccount = vi.fn();
const listRates = vi.fn();
const upsertRate = vi.fn();
const ensureTodayRates = vi.fn();

vi.mock('../api/accounts', () => ({
  listAccounts: (...a: unknown[]) => listAccounts(...a),
  addAccount: (...a: unknown[]) => addAccount(...a),
  updateAccount: (...a: unknown[]) => updateAccount(...a),
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
}));
vi.mock('../api/rates', () => ({
  listRates: (...a: unknown[]) => listRates(...a),
  upsertRate: (...a: unknown[]) => upsertRate(...a),
  ensureTodayRates: (...a: unknown[]) => ensureTodayRates(...a),
}));

import Accounts from './Accounts';

const ROWS = [
  { id: 1, name: 'Chase', icon: '🏦', currency: 'USD', balance: 2550.18, display_order: 1 },
  { id: 2, name: 'Revolut', icon: '💳', currency: 'EUR', balance: 1800, display_order: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  listAccounts.mockResolvedValue(ROWS);
  listRates.mockResolvedValue([]);
  ensureTodayRates.mockImplementation((existing: unknown) => Promise.resolve(existing));
  updateAccount.mockResolvedValue(undefined);
  deleteAccount.mockResolvedValue(undefined);
  upsertRate.mockResolvedValue(undefined);
});

describe('Accounts page', () => {
  it('loads and lists accounts', async () => {
    render(<Accounts onBack={vi.fn()} base="USD" />);
    expect(await screen.findByDisplayValue('Chase')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Revolut')).toBeInTheDocument();
  });

  it('tops up today’s rates on mount', async () => {
    render(<Accounts onBack={vi.fn()} base="USD" />);
    await waitFor(() => expect(ensureTodayRates).toHaveBeenCalled());
  });

  it('adds an account', async () => {
    addAccount.mockResolvedValue({
      id: 3, name: 'Cash', icon: '🏦', currency: 'USD', balance: 0, display_order: 3,
    });
    render(<Accounts onBack={vi.fn()} base="USD" />);
    await screen.findByDisplayValue('Chase');

    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    const draft = screen.getByPlaceholderText(/new account name/i);
    fireEvent.change(draft, { target: { value: 'Cash' } });
    fireEvent.blur(draft);

    await waitFor(() => expect(addAccount).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cash' }),
    ));
    expect(await screen.findByDisplayValue('Cash')).toBeInTheDocument();
  });

  it('does not add an account with a blank name', async () => {
    render(<Accounts onBack={vi.fn()} base="USD" />);
    await screen.findByDisplayValue('Chase');
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    fireEvent.blur(screen.getByPlaceholderText(/new account name/i));
    expect(addAccount).not.toHaveBeenCalled();
  });

  it('persists a balance edit', async () => {
    render(<Accounts onBack={vi.fn()} base="USD" />);
    const input = await screen.findByLabelText('Balance for Chase');
    fireEvent.change(input, { target: { value: '3000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith(1, { balance: 3000 }));
  });

  // Optimistic update must not survive a failed write.
  it('rolls back and shows an error when a save fails', async () => {
    updateAccount.mockRejectedValue(new Error('network down'));
    render(<Accounts onBack={vi.fn()} base="USD" />);
    const input = await screen.findByLabelText('Balance for Chase');
    fireEvent.change(input, { target: { value: '3000' } });
    fireEvent.blur(input);

    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
  });

  it('deletes an account after confirmation', async () => {
    render(<Accounts onBack={vi.fn()} base="USD" />);
    await screen.findByDisplayValue('Chase');
    fireEvent.click(screen.getByLabelText('Delete Chase'));
    fireEvent.click(screen.getByLabelText('Confirm delete Chase'));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByDisplayValue('Chase')).toBeNull());
  });

  it('saves a manually entered rate', async () => {
    render(<Accounts onBack={vi.fn()} base="USD" />);
    await screen.findByDisplayValue('Chase');

    fireEvent.change(screen.getByLabelText('Manual rate currency'), { target: { value: 'VES' } });
    fireEvent.change(screen.getByLabelText('Manual rate date'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('Manual rate value'), { target: { value: '540' } });
    fireEvent.click(screen.getByRole('button', { name: /save rate/i }));

    await waitFor(() => expect(upsertRate).toHaveBeenCalledWith(expect.objectContaining({
      currency: 'VES', rateDate: '2026-05-01', unitsPerUsd: 540, source: 'manual',
    })));
  });

  it('calls onBack', async () => {
    const onBack = vi.fn();
    render(<Accounts onBack={onBack} base="USD" />);
    await screen.findByDisplayValue('Chase');
    fireEvent.click(screen.getByRole('button', { name: /back to budget/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('surfaces a load failure', async () => {
    listAccounts.mockRejectedValue(new Error('load failed'));
    render(<Accounts onBack={vi.fn()} base="USD" />);
    expect(await screen.findByText(/load failed/i)).toBeInTheDocument();
  });
});
