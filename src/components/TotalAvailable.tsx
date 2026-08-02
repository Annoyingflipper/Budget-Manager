import { formatCurrency, type Currency } from '../utils/currency';
import { subtotalsByCurrency, grandTotal } from '../utils/accountTotals';
import type { RateRow } from '../utils/rates';
import type { Account } from '../types';

type Props = {
  accounts: Account[];
  rates: RateRow[];
  base: Currency;
  date: string;
  compact?: boolean;
  onOpen?: () => void;
};

export default function TotalAvailable({ accounts, rates, base, date, compact, onOpen }: Props) {
  const subtotals = subtotalsByCurrency(accounts);
  const total = grandTotal(accounts, base, rates, date);

  if (compact) {
    if (accounts.length === 0) return null;
    return (
      <button
        type="button"
        onClick={onOpen}
        data-testid="total-available-card"
        className="w-full text-left bg-card rounded-xl p-4 mb-4"
      >
        <div className="text-xs uppercase tracking-wider text-muted">Total available</div>
        {total === null ? (
          <div data-testid="total-unavailable" className="text-sm text-muted mt-1">
            Set an exchange rate to see your total
          </div>
        ) : (
          <div className="text-2xl font-extrabold" data-testid="grand-total">
            {formatCurrency(total, base)}
          </div>
        )}
        <div className="text-xs text-muted">
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} ›
        </div>
      </button>
    );
  }

  if (accounts.length === 0) {
    return (
      <div data-testid="accounts-empty" className="text-muted text-sm">
        No accounts yet. Add one to see your total.
      </div>
    );
  }

  return (
    <section className="bg-card rounded-xl p-4">
      {subtotals.map((s) => (
        <div key={s.currency} className="flex justify-between text-sm">
          <span className="text-muted">{s.currency} subtotal</span>
          <span data-testid={`subtotal-${s.currency}`} className="font-bold">
            {formatCurrency(s.total, s.currency)}
          </span>
        </div>
      ))}
      <div className="border-t border-highlight mt-2 pt-2 flex justify-between items-baseline">
        <span className="text-xs uppercase tracking-wider text-muted">
          Total available ({base})
        </span>
        {total === null ? (
          <span data-testid="total-unavailable" className="text-sm text-muted">
            Set an exchange rate to see your total
          </span>
        ) : (
          <span data-testid="grand-total" className="text-2xl font-extrabold">
            {formatCurrency(total, base)}
          </span>
        )}
      </div>
    </section>
  );
}
