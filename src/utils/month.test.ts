import { describe, it, expect } from 'vitest';
import { formatMonth, nextMonth, prevMonth, formatMonthLabel } from './month';

describe('month utils', () => {
  it('formatMonth turns a Date into YYYY-MM-01', () => {
    expect(formatMonth(new Date(2026, 5, 15))).toBe('2026-06-01'); // June (0-indexed = 5)
    expect(formatMonth(new Date(2027, 0, 1))).toBe('2027-01-01');
    expect(formatMonth(new Date(2026, 11, 31))).toBe('2026-12-01');
  });

  it('nextMonth advances by one calendar month, wrapping December', () => {
    expect(nextMonth('2026-06-01')).toBe('2026-07-01');
    expect(nextMonth('2026-12-01')).toBe('2027-01-01');
    expect(nextMonth('2026-01-01')).toBe('2026-02-01');
  });

  it('prevMonth steps back by one calendar month, wrapping January', () => {
    expect(prevMonth('2026-07-01')).toBe('2026-06-01');
    expect(prevMonth('2027-01-01')).toBe('2026-12-01');
    expect(prevMonth('2026-02-01')).toBe('2026-01-01');
  });

  it('formatMonthLabel renders the human label', () => {
    expect(formatMonthLabel('2026-06-01')).toBe('June 2026');
    expect(formatMonthLabel('2027-01-01')).toBe('January 2027');
    expect(formatMonthLabel('2026-12-01')).toBe('December 2026');
  });
});
