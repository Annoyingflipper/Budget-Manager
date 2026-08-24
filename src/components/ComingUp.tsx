import { useState } from 'react';
import { summariseDue, type DueBucket, type DueGroup } from '../utils/dueStatus';
import { grandTotal } from '../utils/accountTotals';
import { formatCurrency, type Currency } from '../utils/currency';
import { todayISO } from '../utils/date';
import type { RateRow } from '../utils/rates';
import type { Account, CategoryWithItems } from '../types';

type Props = {
  categories: CategoryWithItems[];
  accounts: Account[];
  rates: RateRow[];
  base: Currency;
};

const BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  dueSoon: 'Due in 7 days',
  later: 'Later',
};

const BUCKET_TONE: Record<DueBucket, string> = {
  overdue: 'text-negative',
  dueSoon: 'text-warning',
  later: 'text-muted',
};

export default function ComingUp({ categories, accounts, rates, base }: Props) {
  const today = todayISO();
  const summary = summariseDue(categories, today);
  const [expanded, setExpanded] = useState<DueBucket | null>(null);

  // Nothing unpaid and dated: stay out of the way entirely. No empty state —
  // the dashboard should look untouched until due dates are actually used.
  if (summary.isEmpty) return null;

  const available = accounts.length > 0 ? grandTotal(accounts, base, rates, today) : undefined;
  const shortfall =
    available === undefined || available === null ? null : summary.actionableAmount - available;

  function row(bucket: DueBucket, group: DueGroup) {
    if (group.count === 0) return null;
    const isOpen = expanded === bucket;
    return (
      <div key={bucket}>
        <button
          type="button"
          data-testid={`bucket-${bucket}`}
          aria-expanded={isOpen}
          onClick={() => setExpanded(isOpen ? null : bucket)}
          className="w-full flex justify-between items-center py-1 text-sm"
        >
          <span className={`font-bold ${BUCKET_TONE[bucket]}`}>{BUCKET_LABEL[bucket]}</span>
          <span className="text-muted">
            {group.count} {group.count === 1 ? 'item' : 'items'} ·{' '}
            <span className="font-bold">{formatCurrency(group.amount, base)}</span>
          </span>
        </button>
        {isOpen && (
          <ul className="pl-3 pb-1 space-y-0.5">
            {group.items.map((i) => (
              <li key={i.id} className="flex justify-between text-xs text-muted">
                <span>{i.name}</span>
                <span>
                  {i.dueOn} · {formatCurrency(i.baseProjected, base)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section data-testid="coming-up" className="bg-card rounded-xl px-4 py-3 mb-3">
      <div className="text-xs uppercase tracking-wider text-muted mb-1">⏰ Coming up</div>

      {row('overdue', summary.overdue)}
      {row('dueSoon', summary.dueSoon)}
      {row('later', summary.later)}

      {available !== undefined && (
        <div
          data-testid="cashflow-verdict"
          className="border-t border-highlight mt-2 pt-2 text-xs"
        >
          {available === null ? (
            <span className="text-muted">Set an exchange rate to compare with your accounts</span>
          ) : (
            <>
              <div className="text-muted">
                {formatCurrency(summary.actionableAmount, base)} due soon ·{' '}
                {formatCurrency(available, base)} available
              </div>
              {shortfall !== null && shortfall > 0 ? (
                <div className="text-negative font-bold mt-0.5">
                  Short by {formatCurrency(shortfall, base)}
                </div>
              ) : (
                <div className="text-positive font-bold mt-0.5">✓ Covered</div>
              )}
              <div className="text-muted mt-0.5">balances as you last set them</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
