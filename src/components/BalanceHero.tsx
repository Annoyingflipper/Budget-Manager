import { differenceClass, formatMoney } from '../utils/money';
import type { CategoryWithItems, Income } from '../types';

type Props = {
  income: Income;
  categories: CategoryWithItems[];
};

export default function BalanceHero({ income, categories }: Props) {
  const costProjected = categories.flatMap((c) => c.items).reduce((s, i) => s + i.projected, 0);
  const costActual = categories.flatMap((c) => c.items).reduce((s, i) => s + i.actual, 0);
  const projectedBalance = income.projected - costProjected;
  const actualBalance = income.actual - costActual;
  const balanceDelta = actualBalance - projectedBalance;
  const balanceClass = differenceClass('income', balanceDelta);

  return (
    <section className="bg-card rounded-xl p-4 mb-4">
      <div className="text-xs uppercase tracking-wider text-muted">Where you stand</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
        <div>
          <div className="text-xs text-muted">Projected balance</div>
          <div className="text-2xl font-extrabold">{formatMoney(projectedBalance)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Actual balance</div>
          <div className={`text-2xl font-extrabold ${balanceClass}`}>
            {formatMoney(actualBalance)}
          </div>
        </div>
      </div>
    </section>
  );
}
