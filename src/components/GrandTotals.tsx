import { difference, formatMoney, sum } from '../utils/money';
import type { CategoryWithItems } from '../types';

type Props = { categories: CategoryWithItems[] };

export default function GrandTotals({ categories }: Props) {
  const allItems = categories.flatMap((c) => c.items);
  // base* rather than the native amounts: an expense recorded in bolivares must
  // contribute its converted value, not its face number.
  const totalProjected = sum(allItems.map((i) => i.baseProjected));
  const totalActual = sum(allItems.map((i) => i.baseActual));
  const totalDiff = difference(totalActual, totalProjected);
  // text-*-on-hero, not text-negative/text-positive: this section renders on
  // --hero-bg, not --bg/--card, and no single token clears 4.5:1 on all three
  // surfaces (see src/theme/tokens.test.ts's "on --hero-bg" suite).
  const diffColor =
    totalDiff === 0 ? 'opacity-70' : totalDiff > 0 ? 'text-negative-on-hero' : 'text-positive-on-hero';

  return (
    <section className="bg-hero-bg text-hero-text rounded-card p-4 mt-4">
      <div className="text-caption uppercase tracking-widest opacity-70">Grand totals</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
        <div>
          <div className="text-caption opacity-60">Total Projected</div>
          <div className="text-display">{formatMoney(totalProjected)}</div>
        </div>
        <div>
          <div className="text-caption opacity-60">Total Actual</div>
          <div className="text-display">{formatMoney(totalActual)}</div>
        </div>
        <div>
          <div className="text-caption opacity-60">Difference</div>
          <div className={`text-display ${diffColor}`}>{formatMoney(totalDiff)}</div>
        </div>
      </div>
    </section>
  );
}
