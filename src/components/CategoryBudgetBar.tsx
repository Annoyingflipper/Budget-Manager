import { categoryBudgetStatus } from '../utils/budgetHealth';
import { formatMoney } from '../utils/money';
import type { BudgetState } from '../utils/budgetHealth';

type Props = {
  categoryId: number;
  categoryName: string;
  projected: number;
  actual: number;
};

const FILL_CLASS: Record<Exclude<BudgetState, 'empty'>, string> = {
  under: 'bg-positive',
  near: 'bg-warning',
  over: 'bg-negative',
};

export default function CategoryBudgetBar({ categoryId, categoryName, projected, actual }: Props) {
  const { ratio, state, overBy } = categoryBudgetStatus(projected, actual);
  if (state === 'empty') return null;

  const pct = Math.round(ratio * 100);
  const label =
    state === 'over'
      ? `${categoryName} budget: over by ${formatMoney(overBy)}`
      : `${categoryName} budget: ${pct}% of projected spent`;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      data-state={state}
      data-testid={`budget-bar-${categoryId}`}
      className="h-1.5 w-full rounded-full bg-bg overflow-hidden mb-2"
    >
      <div className={`h-full rounded-full ${FILL_CLASS[state]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
