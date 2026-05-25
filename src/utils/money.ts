export type DifferenceRole = 'income' | 'cost';

export function difference(actual: number, projected: number): number {
  return roundCents(actual - projected);
}

export function differenceClass(role: DifferenceRole, value: number): string {
  if (value === 0) return 'text-gray-500';
  if (role === 'income') {
    return value > 0 ? 'text-green-600' : 'text-red-600';
  }
  return value > 0 ? 'text-red-600' : 'text-green-600';
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

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
