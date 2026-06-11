export type BudgetState = 'empty' | 'under' | 'near' | 'over';

export type BudgetStatus = {
  ratio: number; // 0..1, used for the fill width
  state: BudgetState;
  overBy: number; // max(0, actual - projected), rounded to cents
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function categoryBudgetStatus(projected: number, actual: number): BudgetStatus {
  if (projected === 0 && actual === 0) {
    return { ratio: 0, state: 'empty', overBy: 0 };
  }
  if (actual > projected) {
    return { ratio: 1, state: 'over', overBy: roundCents(actual - projected) };
  }
  const raw = projected > 0 ? actual / projected : 0;
  const ratio = Math.min(Math.max(raw, 0), 1);
  return { ratio, state: ratio >= 0.9 ? 'near' : 'under', overBy: 0 };
}
