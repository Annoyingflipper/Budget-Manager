const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

export function nextMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${pad2(month + 1)}-01`;
}

export function prevMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (month === 1) return `${year - 1}-12-01`;
  return `${year}-${pad2(month - 1)}-01`;
}

export function formatMonthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
