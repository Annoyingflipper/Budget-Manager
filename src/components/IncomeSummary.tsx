import { useEffect, useState } from 'react';
import { updateIncome } from '../api/budget';
import { difference, differenceClass, formatMoney, sum } from '../utils/money';
import BalanceCards from './BalanceCards';
import type { CategoryWithItems, Income } from '../types';

type Props = {
  income: Income;
  categories: CategoryWithItems[];
  onChange: (patch: Partial<Income>) => void;
};

export default function IncomeSummary({ income, categories, onChange }: Props) {
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
    try {
      await updateIncome({ projected: value });
    } catch {
      onChange({ projected: previous });
    }
  }

  async function saveActual() {
    const value = Number(actualDraft) || 0;
    if (value === income.actual) return;
    const previous = income.actual;
    onChange({ actual: value });
    try {
      await updateIncome({ actual: value });
    } catch {
      onChange({ actual: previous });
    }
  }

  const totalProjectedCost = sum(categories.flatMap((c) => c.items.map((i) => i.projected)));
  const totalActualCost = sum(categories.flatMap((c) => c.items.map((i) => i.actual)));
  const projectedBalance = income.projected - totalProjectedCost;
  const actualBalance = income.actual - totalActualCost;

  return (
    <section className="border rounded-lg p-4 bg-white space-y-3">
      <h2 className="text-xl font-medium">Income</h2>
      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm text-gray-500">Projected</span>
          <input
            type="number"
            step="0.01"
            value={projectedDraft}
            onChange={(e) => setProjectedDraft(e.target.value)}
            onBlur={saveProjected}
            className="w-full border rounded px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-500">Actual</span>
          <input
            type="number"
            step="0.01"
            value={actualDraft}
            onChange={(e) => setActualDraft(e.target.value)}
            onBlur={saveActual}
            className="w-full border rounded px-2 py-1"
          />
        </label>
        <div>
          <span className="text-sm text-gray-500">Difference</span>
          <p className={`text-lg font-medium ${differenceClass('income', diff)}`}>
            {formatMoney(diff)}
          </p>
        </div>
      </div>
      <BalanceCards projected={projectedBalance} actual={actualBalance} />
    </section>
  );
}
