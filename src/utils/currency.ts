export const CURRENCIES = {
  USD: { symbol: '$', label: 'US Dollar' },
  EUR: { symbol: '€', label: 'Euro' },
  VES: { symbol: 'Bs.', label: 'Bolívar' },
} as const;

export type Currency = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as Currency[];

const DECIMAL = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Intl has no symbol for VES — it renders "VES 1,234.50" — so that one currency
 * is formatted as a plain decimal with a manual "Bs. " prefix. USD and EUR use
 * Intl's currency style directly.
 */
export function formatCurrency(value: number, currency: Currency): string {
  if (currency === 'VES') {
    const sign = value < 0 ? '-' : '';
    return `${sign}Bs. ${DECIMAL.format(Math.abs(value))}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}
