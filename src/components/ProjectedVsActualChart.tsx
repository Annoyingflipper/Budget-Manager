import { formatMoney } from '../utils/money';
import type { CategoryTotal } from '../types';

type Props = { totals: CategoryTotal[] };

export default function ProjectedVsActualChart({ totals }: Props) {
  const visible = totals.filter((t) => t.projected > 0 || t.actual > 0);
  if (visible.length === 0) {
    return <p className="text-muted text-sm">No spending to chart yet.</p>;
  }
  const max = Math.max(...visible.map((t) => Math.max(t.projected, t.actual)), 1);

  return (
    <section className="bg-card rounded-xl p-4 space-y-3">
      {visible.map((t) => {
        const over = t.actual > t.projected;
        return (
          <div key={t.id} data-testid={`chart-row-${t.id}`}>
            <div className="flex justify-between text-sm font-bold mb-1">
              <span>{t.icon} {t.name}</span>
              <span className={over ? 'text-negative' : 'text-positive'}>
                {formatMoney(t.actual)} / {formatMoney(t.projected)}
              </span>
            </div>
            <div className="space-y-1" aria-hidden="true">
              <div
                className="h-2 rounded-sm bg-muted"
                style={{ width: `${(t.projected / max) * 100}%` }}
              />
              <div
                className={`h-2 rounded-sm ${over ? 'bg-negative' : 'bg-positive'}`}
                style={{ width: `${(t.actual / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
