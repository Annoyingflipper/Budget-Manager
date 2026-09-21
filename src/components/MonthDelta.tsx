import { formatMoney } from '../utils/money';
import type { MonthDelta as MonthDeltaT } from '../types';

type Props = { delta: MonthDeltaT };

export default function MonthDelta({ delta }: Props) {
  if (!delta.hasPrior) {
    return <p className="text-muted text-body">No prior month to compare.</p>;
  }

  return (
    <section className="bg-card rounded-card p-4">
      <div className="text-caption uppercase tracking-widest text-muted mb-2">
        vs last month
      </div>
      <ul className="space-y-1">
        {delta.rows.map((r) => {
          const cls =
            r.delta > 0 ? 'text-negative' : r.delta < 0 ? 'text-positive' : 'text-muted';
          const arrow = r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '';
          const label = r.delta === 0 ? 'same' : `${arrow} ${formatMoney(Math.abs(r.delta))}`;
          return (
            <li key={r.id} className="flex justify-between items-center text-body gap-2">
              <span className="flex-1">{r.icon} {r.name}</span>
              <span className="text-money text-muted">{formatMoney(r.currentActual)}</span>
              <span className={`${cls} text-money min-w-20 text-right`}>{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
