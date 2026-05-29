import { useEffect, useState } from 'react';
import { updateIncome } from '../api/budget';
import { difference, differenceClass, formatMoney } from '../utils/money';
import type { Income } from '../types';

type Props = {
  income: Income;
  periodMonth: string;
  onChange: (patch: Partial<Income>) => void;
};

export default function IncomeSummary({ income, periodMonth, onChange }: Props) {
  const [projectedDraft, setProjectedDraft] = useState(String(income.projected));
  const [actualDraft, setActualDraft] = useState(String(income.actual));

  useEffect(() => { setProjectedDraft(String(income.projected)); }, [income.projected]);
  useEffect(() => { setActualDraft(String(income.actual)); }, [income.actual]);

  const diff = difference(income.actual, income.projected);

  async function saveProjected() {
    const value = Number(projectedDraft) || 0;
    if (value === income.projected) return;
    const previous = income.projected;
    onChange({ projected: value });
    try { await updateIncome(periodMonth, { projected: value }); }
    catch { onChange({ projected: previous }); }
  }

  async function saveActual() {
    const value = Number(actualDraft) || 0;
    if (value === income.actual) return;
    const previous = income.actual;
    onChange({ actual: value });
    try { await updateIncome(periodMonth, { actual: value }); }
    catch { onChange({ actual: previous }); }
  }

  return (
    <section className="bg-card rounded-xl p-4 mb-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-lg">💰</span>
        <span className="font-extrabold text-sm">Income</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <label className="block">
          <div className="text-xs text-muted">Projected</div>
          <input
            type="number"
            step="0.01"
            value={projectedDraft}
            onChange={(e) => setProjectedDraft(e.target.value)}
            onBlur={saveProjected}
            className="w-full px-2 py-1 border border-highlight rounded-md bg-bg text-base font-bold"
          />
        </label>
        <label className="block">
          <div className="text-xs text-muted">Actual</div>
          <input
            type="number"
            step="0.01"
            value={actualDraft}
            onChange={(e) => setActualDraft(e.target.value)}
            onBlur={saveActual}
            className="w-full px-2 py-1 border border-highlight rounded-md bg-bg text-base font-bold"
          />
        </label>
        <div className="col-span-2 sm:col-span-1">
          <div className="text-xs text-muted">Difference</div>
          <div className={`text-base font-bold ${differenceClass('income', diff)}`}>
            {formatMoney(diff)}
          </div>
        </div>
      </div>
    </section>
  );
}
