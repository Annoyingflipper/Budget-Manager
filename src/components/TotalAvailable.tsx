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
        className="w-full text-left bg-card rounded-card p-4 mb-4"
      >
        <div className="text-caption uppercase tracking-wider text-muted">Total available</div>
        {total === null ? (
          <div data-testid="total-unavailable" className="text-body text-muted mt-1">
            Set an exchange rate to see your total
          </div>
        ) : (
          // text-title, not text-money: tabular figures exist to align a COLUMN
          // of amounts, and this is a single figure between two captions. At
          // text-money it rendered the same size as the "1 account" line below
          // it, so the card read as having no subject. The full variant further
          // down keeps text-money, where it really is in a column of subtotals.
          <div className="text-title" data-testid="grand-total">
            {formatCurrency(total, base)}
          </div>
        )}
        <div className="text-caption text-muted">
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} ›
        </div>
      </button>
    );
  }

  if (accounts.length === 0) {
    return (
      <div data-testid="accounts-empty" className="text-muted text-body">
        No accounts yet. Add one to see your total.
      </div>
    );
  }

  return (
    <section className="bg-card rounded-card p-4">
      {subtotals.map((s) => (
        <div key={s.currency} className="flex justify-between text-body">
          <span className="text-muted">{s.currency} subtotal</span>
          <span data-testid={`subtotal-${s.currency}`} className="text-money">
            {formatCurrency(s.total, s.currency)}
          </span>
        </div>
      ))}
      <div className="border-t border-highlight mt-2 pt-2 flex justify-between items-baseline">
        <span className="text-caption uppercase tracking-wider text-muted">
          Total available ({base})
        </span>
        {total === null ? (
          <span data-testid="total-unavailable" className="text-body text-muted">
            Set an exchange rate to see your total
          </span>
        ) : (
          <span data-testid="grand-total" className="text-money">
            {formatCurrency(total, base)}
          </span>
        )}
      </div>
    </section>
  );
}
