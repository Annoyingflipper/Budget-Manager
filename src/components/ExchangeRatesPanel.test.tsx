import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExchangeRatesPanel from './ExchangeRatesPanel';
import type { RateRow } from '../utils/rates';

const RATES: RateRow[] = [
  { currency: 'EUR', rateDate: '2026-08-01', unitsPerUsd: 0.8707, source: 'ecb' },
  { currency: 'VES', rateDate: '2026-07-25', unitsPerUsd: 746.6297, source: 'bcv' },
];

function setup(overrides: Partial<React.ComponentProps<typeof ExchangeRatesPanel>> = {}) {
  const props = {
    rates: RATES,
    date: '2026-08-01',
    onSaveRate: vi.fn(),
    onRefresh: vi.fn(),
    refreshing: false,
    ...overrides,
  };
  render(<ExchangeRatesPanel {...props} />);
  return props;
}

describe('ExchangeRatesPanel', () => {
  it('shows each rate as units per USD', () => {
    setup();
    expect(screen.getByTestId('rate-EUR')).toHaveTextContent('0.8707');
    expect(screen.getByTestId('rate-VES')).toHaveTextContent('746.6297');
  });

  it('labels each rate with its source', () => {
    setup();
    expect(screen.getByTestId('rate-EUR')).toHaveTextContent(/ECB/i);
    expect(screen.getByTestId('rate-VES')).toHaveTextContent(/BCV/i);
  });

  it('shows the date a carried-forward rate actually came from', () => {
    setup();
    expect(screen.getByTestId('rate-VES')).toHaveTextContent('2026-07-25');
  });

  it('says so when a currency has no rate at all', () => {
    setup({ rates: [] });
    expect(screen.getByTestId('rate-EUR')).toHaveTextContent(/not set/i);
    expect(screen.getByTestId('rate-VES')).toHaveTextContent(/not set/i);
  });

  it('calls onRefresh when refresh is clicked', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /refresh rates/i }));
    expect(props.onRefresh).toHaveBeenCalled();
  });

  it('disables refresh while a refresh is in flight', () => {
    setup({ refreshing: true });
    expect(screen.getByRole('button', { name: /refresh rates/i })).toBeDisabled();
  });

  it('saves a manually entered rate for a chosen date', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('Manual rate currency'), { target: { value: 'VES' } });
    fireEvent.change(screen.getByLabelText('Manual rate date'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('Manual rate value'), { target: { value: '540' } });
    fireEvent.click(screen.getByRole('button', { name: /save rate/i }));
    expect(props.onSaveRate).toHaveBeenCalledWith('VES', '2026-05-01', 540);
  });

  it('refuses to save a zero or negative rate', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('Manual rate date'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('Manual rate value'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /save rate/i }));
    expect(props.onSaveRate).not.toHaveBeenCalled();
  });

  it('refuses to save without a date', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('Manual rate value'), { target: { value: '540' } });
    fireEvent.click(screen.getByRole('button', { name: /save rate/i }));
    expect(props.onSaveRate).not.toHaveBeenCalled();
  });
});
