export type DifferenceRole = 'income' | 'cost';

export function difference(actual: number, projected: number): number {
  return roundCents(actual - projected);
}

export function differenceClass(role: DifferenceRole, value: number): string {
  if (value === 0) return 'text-muted';
  if (role === 'income') {
    return value > 0 ? 'text-positive' : 'text-negative';
  }
  return value > 0 ? 'text-negative' : 'text-positive';
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function sum(values: number[]): number {
  return roundCents(values.reduce((acc, v) => acc + v, 0));
}

export function balanceNarrative(args: {
  projectedBalance: number;
  actualBalance: number;
  incomeProjected: number;
  incomeActual: number;
  costProjected: number;
  costActual: number;
}): string {
  const balanceDelta = args.actualBalance - args.projectedBalance;
  const costDelta = args.costActual - args.costProjected;
  const incomeDelta = args.incomeActual - args.incomeProjected;

  if (balanceDelta === 0 && costDelta === 0 && incomeDelta === 0) {
    return "You're right on projection.";
  }

  const balancePart =
    balanceDelta > 0
      ? `You're ${formatMoney(balanceDelta)} ahead of projection`
      : balanceDelta < 0
      ? `You're ${formatMoney(Math.abs(balanceDelta))} behind projection`
      : `You're right on projection`;

  const costPart =
    costDelta > 0
      ? `costs are up ${formatMoney(costDelta)}`
      : costDelta < 0
      ? `costs are down ${formatMoney(Math.abs(costDelta))}`
      : `costs are on budget`;

  const incomePart =
    incomeDelta > 0
      ? `income is up ${formatMoney(incomeDelta)}`
      : incomeDelta < 0
      ? `income is down ${formatMoney(Math.abs(incomeDelta))}`
      : `income is on budget`;

  return `${balancePart} — ${costPart} and ${incomePart}.`;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
