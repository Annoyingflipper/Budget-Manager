function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Today's date in the local timezone as `YYYY-MM-DD`. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * `iso` shifted by `n` days, still as `YYYY-MM-DD`.
 *
 * Built from components rather than `new Date(iso)` on purpose: string parsing
 * treats the value as UTC midnight, which is the previous day in any western
 * timezone. The component constructor is local-time and handles month, year and
 * leap-year rollover for free.
 */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const shifted = new Date(y, m - 1, d + n);
  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}-${pad2(shifted.getDate())}`;
}
