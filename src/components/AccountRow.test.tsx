import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccountRow from './AccountRow';
import type { Account } from '../types';

const ACCOUNT: Account = {
  id: 1, name: 'Chase Checking', icon: '🏦', currency: 'USD',
  balance: 2430.18, display_order: 1,
};

function setup(overrides: Partial<React.ComponentProps<typeof AccountRow>> = {}) {
  const props = {
    account: ACCOUNT,
    onChange: vi.fn(),
    onDelete: vi.fn(),
    confirmingDelete: false,
    onRequestDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    ...overrides,
  };
  render(<AccountRow {...props} />);
  return props;
}

describe('AccountRow', () => {
  it('shows the name, icon and balance', () => {
    setup();
    expect(screen.getByDisplayValue('Chase Checking')).toBeInTheDocument();
    expect(screen.getByText('🏦')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2430.18')).toBeInTheDocument();
  });

  it('commits a renamed account on blur', () => {
    const props = setup();
    const input = screen.getByDisplayValue('Chase Checking');
    fireEvent.change(input, { target: { value: 'Chase Main' } });
    fireEvent.blur(input);
    expect(props.onChange).toHaveBeenCalledWith(1, { name: 'Chase Main' });
  });

  it('does not fire onChange when the name is unchanged', () => {
    const props = setup();
    fireEvent.blur(screen.getByDisplayValue('Chase Checking'));
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('commits a balance as a number, not a string', () => {
    const props = setup();
    const input = screen.getByDisplayValue('2430.18');
    fireEvent.change(input, { target: { value: '99.5' } });
    fireEvent.blur(input);
    expect(props.onChange).toHaveBeenCalledWith(1, { balance: 99.5 });
  });

  it('accepts a negative balance so a credit card can be modelled', () => {
    const props = setup();
    const input = screen.getByDisplayValue('2430.18');
    fireEvent.change(input, { target: { value: '-450' } });
    fireEvent.blur(input);
    expect(props.onChange).toHaveBeenCalledWith(1, { balance: -450 });
  });

  it('ignores a balance that is not a number', () => {
    const props = setup();
    const input = screen.getByDisplayValue('2430.18');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('changes currency through the select', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('Currency for Chase Checking'),
      { target: { value: 'VES' } });
    expect(props.onChange).toHaveBeenCalledWith(1, { currency: 'VES' });
  });

  it('asks the parent to start a delete rather than deleting directly', () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText('Delete Chase Checking'));
    expect(props.onRequestDelete).toHaveBeenCalledWith(1);
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('deletes only after the confirm affordance is clicked', () => {
    const props = setup({ confirmingDelete: true });
    fireEvent.click(screen.getByLabelText('Confirm delete Chase Checking'));
    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it('renders a negative balance in the negative colour', () => {
    setup({ account: { ...ACCOUNT, balance: -450 } });
    expect(screen.getByTestId('account-balance-1').className).toContain('text-negative');
  });
});
