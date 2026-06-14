import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayISO } from './date';

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
