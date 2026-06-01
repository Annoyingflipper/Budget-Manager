import { sum } from './money';
import type { Budget, CategoryTotal, DeltaRow, MonthDelta, ExportRow } from '../types';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function categoryTotals(b: Budget): CategoryTotal[] {
  return b.categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    projected: sum(c.items.map((i) => i.projected)),
    actual: sum(c.items.map((i) => i.actual)),
  }));
}

export function buildMonthDelta(
  current: CategoryTotal[],
  previous: CategoryTotal[] | null,
): MonthDelta {
  if (previous === null) return { hasPrior: false };
  const prevById = new Map(previous.map((c) => [c.id, c]));
  const seen = new Set<number>();
  const rows: DeltaRow[] = [];

  for (const cur of current) {
    seen.add(cur.id);
    const prevActual = prevById.get(cur.id)?.actual ?? 0;
    rows.push({
      id: cur.id,
      name: cur.name,
      icon: cur.icon,
      currentActual: cur.actual,
      prevActual,
      delta: roundCents(cur.actual - prevActual),
    });
  }
  for (const prev of previous) {
    if (seen.has(prev.id)) continue;
    rows.push({
      id: prev.id,
      name: prev.name,
      icon: prev.icon,
      currentActual: 0,
      prevActual: prev.actual,
      delta: roundCents(0 - prev.actual),
    });
  }
  return { hasPrior: true, rows };
}

export function budgetToExportRows(month: string, b: Budget): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const c of b.categories) {
    for (const i of c.items) {
      rows.push({
        month,
        category: c.name,
        item: i.name,
        projected: i.projected,
        actual: i.actual,
      });
    }
  }
  return rows;
}
