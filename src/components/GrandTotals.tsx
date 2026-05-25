import { difference, formatMoney, sum } from '../utils/money';
import type { CategoryWithItems } from '../types';

type Props = { categories: CategoryWithItems[] };

export default function GrandTotals({ categories }: Props) {
  const allItems = categories.flatMap((c) => c.items);
  const totalProjected = sum(allItems.map((i) => i.projected));
  const totalActual = sum(allItems.map((i) => i.actual));
  const totalDiff = difference(totalActual, totalProjected);
  const diffColor = totalDiff === 0 ? 'opacity-70' : totalDiff > 0 ? 'text-negative' : 'text-positive';

  return (
    <section className="bg-hero-bg text-hero-text rounded-xl p-4 mt-4">
      <div className="text-[10px] uppercase tracking-widest opacity-70">Grand totals</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
        <div>
          <div className="text-[9px] opacity-60">Total Projected</div>
          <div className="text-lg font-extrabold">{formatMoney(totalProjected)}</div>
        </div>
        <div>
          <div className="text-[9px] opacity-60">Total Actual</div>
          <div className="text-lg font-extrabold">{formatMoney(totalActual)}</div>
        </div>
        <div>
          <div className="text-[9px] opacity-60">Difference</div>
          <div className={`text-lg font-extrabold ${diffColor}`}>{formatMoney(totalDiff)}</div>
        </div>
      </div>
    </section>
  );
}
