// Month arithmetic for the suite. Deliberately NOT importing src/utils/month.ts:
// specs assert the app's own month labels and export filenames, so reusing the
// app's implementation would make those assertions tautological.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `YYYY-MM-01` for the month containing today, in local time (what the app uses). */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

/** Shift a `YYYY-MM-01` period by whole months; negative deltas go backwards. */
export function addMonths(period: string, delta: number): string {
  const [year, month] = period.split('-').map(Number);
  const absolute = year * 12 + (month - 1) + delta;
  return `${Math.floor(absolute / 12)}-${pad2((absolute % 12) + 1)}-01`;
}

/** Header label, e.g. `2026-08-01` -> `August 2026`. */
export function monthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Filename form used by the CSV export, e.g. `2026-08-01` -> `2026-08`. */
export function monthKey(period: string): string {
  return period.slice(0, 7);
}
