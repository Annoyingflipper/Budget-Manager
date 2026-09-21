import { differenceClass, formatMoney } from '../utils/money';
import type { CategoryWithItems, Income } from '../types';

type Props = {
  income: Income;
  categories: CategoryWithItems[];
};

export default function BalanceHero({ income, categories }: Props) {
  const costProjected = categories.flatMap((c) => c.items).reduce((s, i) => s + i.baseProjected, 0);
  const costActual = categories.flatMap((c) => c.items).reduce((s, i) => s + i.baseActual, 0);
  const projectedBalance = income.projected - costProjected;
  const actualBalance = income.actual - costActual;
  const balanceDelta = actualBalance - projectedBalance;
  const balanceClass = differenceClass('income', balanceDelta);

  return (
    <section className="bg-card rounded-card p-4 mb-4">
      <div className="text-caption uppercase tracking-wider text-muted">Where you stand</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
        <div>
          <div className="text-caption text-muted">Projected balance</div>
          <div className="text-title" data-testid="projected-balance">{formatMoney(projectedBalance)}</div>
        </div>
        <div>
          <div className="text-caption text-muted">Actual balance</div>
          <div className={`text-title ${balanceClass}`} data-testid="actual-balance">
            {formatMoney(actualBalance)}
          </div>
        </div>
      </div>
    </section>
  );
}
