import { useState } from 'react';
import { summariseDue, type DueBucket, type DueGroup } from '../utils/dueStatus';
import { stillToPay } from '../utils/stillToPay';
import { grandTotal } from '../utils/accountTotals';
import { formatCurrency, type Currency } from '../utils/currency';
import { formatMonthLabel } from '../utils/month';
import { todayISO } from '../utils/date';
import type { RateRow } from '../utils/rates';
import type { Account, CategoryWithItems } from '../types';

type Props = {
  categories: CategoryWithItems[];
  accounts: Account[];
  rates: RateRow[];
  base: Currency;
  /** The selected period month ('YYYY-MM-01'), shown in the heading so the
   * panel is never mistaken for "today" when a past month is on screen. */
  month: string;
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

export default function ComingUp({ categories, accounts, rates, base, month }: Props) {
  const today = todayISO();
  const summary = summariseDue(categories, today);
  const [expanded, setExpanded] = useState<DueBucket | null>(null);

  // Nothing unpaid and dated: stay out of the way entirely. No empty state —
  // the dashboard should look untouched until due dates are actually used.
  if (summary.isEmpty) return null;

  // Unpaid items with no due date are excluded from every bucket above (by
  // design — StillToPay already covers them) but must not be silently missing
  // from the panel's solvency claim, or "Covered" reads as "everything is
  // covered" when it only means "every DATED bill is covered".
  const undatedCount =
    stillToPay(categories).count -
    (summary.overdue.count + summary.dueSoon.count + summary.later.count);

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
      <div className="text-xs uppercase tracking-wider text-muted mb-1">
        ⏰ Coming up — {formatMonthLabel(month)}
      </div>

      {row('overdue', summary.overdue)}
      {row('dueSoon', summary.dueSoon)}
      {row('later', summary.later)}

      {undatedCount > 0 && (
        <div data-testid="undated-count" className="text-xs text-muted pt-1">
          {undatedCount} more unpaid, no due date set
        </div>
      )}

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
                  {undatedCount > 0 ? ' — dated bills only' : ''}
                </div>
              ) : (
                <div className="text-positive font-bold mt-0.5">
                  ✓ Covered{undatedCount > 0 ? ' — dated bills only' : ''}
                </div>
              )}
              <div className="text-muted mt-0.5">balances as you last set them</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
