import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayISO, addDays } from './date';

afterEach(() => { vi.useRealTimers(); });

describe('todayISO', () => {
  it('returns the local date as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 9, 30)); // local June 13 2026 09:30
    expect(todayISO()).toBe('2026-06-13');
  });

  it('zero-pads month and day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 23, 59)); // local Jan 5 2026
    expect(todayISO()).toBe('2026-01-05');
  });

  it('always matches the YYYY-MM-DD shape', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-08-10', 5)).toBe('2026-08-15');
  });

  it('rolls over a month boundary', () => {
    expect(addDays('2026-08-30', 7)).toBe('2026-09-06');
  });

  it('rolls over a year boundary', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('subtracts with a negative n', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('returns the same date for n = 0', () => {
    expect(addDays('2026-08-24', 0)).toBe('2026-08-24');
  });
});
