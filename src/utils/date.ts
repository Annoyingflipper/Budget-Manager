function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Today's date in the local timezone as `YYYY-MM-DD`. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
