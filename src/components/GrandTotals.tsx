import { difference, differenceClass, formatMoney, sum } from '../utils/money';
import type { CategoryWithItems } from '../types';

type Props = { categories: CategoryWithItems[] };

export default function GrandTotals({ categories }: Props) {
  const allItems = categories.flatMap((c) => c.items);
  const totalProjected = sum(allItems.map((i) => i.projected));
  const totalActual = sum(allItems.map((i) => i.actual));
  const totalDiff = difference(totalActual, totalProjected);

  return (
    <section className="border rounded-lg p-4 bg-white grid grid-cols-3 gap-4 font-medium">
      <div>
        <span className="text-sm text-gray-500">Total Projected Cost</span>
        <p className="text-xl">{formatMoney(totalProjected)}</p>
      </div>
      <div>
        <span className="text-sm text-gray-500">Total Actual Cost</span>
        <p className="text-xl">{formatMoney(totalActual)}</p>
      </div>
      <div>
        <span className="text-sm text-gray-500">Total Difference</span>
        <p className={`text-xl ${differenceClass('cost', totalDiff)}`}>
          {formatMoney(totalDiff)}
        </p>
      </div>
    </section>
  );
}
