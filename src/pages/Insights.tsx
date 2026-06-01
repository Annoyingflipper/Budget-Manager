import { useEffect, useState } from 'react';
import ProjectedVsActualChart from '../components/ProjectedVsActualChart';
import MonthDelta from '../components/MonthDelta';
import ExportButtons from '../components/ExportButtons';
import { getBudget, listMonths } from '../api/budget';
import { categoryTotals, buildMonthDelta } from '../utils/insights';
import { formatMonthLabel, prevMonth } from '../utils/month';
import type { Budget, MonthDelta as MonthDeltaT } from '../types';

type Props = { selectedMonth: string; budget: Budget; onBack: () => void };

export default function Insights({ selectedMonth, budget, onBack }: Props) {
  const [delta, setDelta] = useState<MonthDeltaT | null>(null);
  const totals = categoryTotals(budget);

  useEffect(() => {
    let cancelled = false;
    const prev = prevMonth(selectedMonth);
    const current = categoryTotals(budget);

    listMonths()
      .then(async (months) => {
        if (!months.includes(prev)) {
          if (!cancelled) setDelta({ hasPrior: false });
          return;
        }
        const prevBudget = await getBudget(prev);
        if (cancelled) return;
        const prevHasLineItems = prevBudget.categories.some((c) => c.items.length > 0);
        setDelta(
          prevHasLineItems
            ? buildMonthDelta(current, categoryTotals(prevBudget))
            : { hasPrior: false },
        );
      })
      .catch(() => {
        if (!cancelled) setDelta({ hasPrior: false });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, budget]);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-muted text-sm hover:text-text"
        >
          ← Back to budget
        </button>
      </header>

      <div>
        <h1 className="text-3xl font-extrabold">Insights</h1>
        <p className="text-muted text-sm">{formatMonthLabel(selectedMonth)}</p>
      </div>

      <ProjectedVsActualChart totals={totals} />
      {delta && <MonthDelta delta={delta} />}
      <ExportButtons month={selectedMonth} budget={budget} />
    </div>
  );
}
