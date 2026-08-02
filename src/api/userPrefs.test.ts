import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: Array<{ kind: string; args: unknown[] }> = [];
const fromMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => { calls.push({ kind: 'from', args }); return fromMock(...args); },
  },
}));

import { getBaseCurrency, setBaseCurrency } from './userPrefs';

beforeEach(() => { calls.length = 0; fromMock.mockReset(); });

describe('base currency preference', () => {
  it('reads the stored base currency', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () =>
        Promise.resolve({ data: { base_currency: 'EUR' }, error: null }) }) }),
    }));
    expect(await getBaseCurrency()).toBe('EUR');
  });

  it('defaults to USD when no row exists', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () =>
        Promise.resolve({ data: null, error: null }) }) }),
    }));
    expect(await getBaseCurrency()).toBe('USD');
  });

  it('upserts the chosen base currency against user_id', async () => {
    fromMock.mockImplementation(() => ({
      upsert: (...args: unknown[]) => {
        calls.push({ kind: 'upsert', args });
        return Promise.resolve({ error: null });
      },
    }));
    await setBaseCurrency('VES');
    const payload = calls.find((c) => c.kind === 'upsert')?.args[0] as Record<string, unknown>;
    expect(payload.base_currency).toBe('VES');
    expect(payload.user_id).toBe('user-1');
  });

  it('throws when the read fails', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () =>
        Promise.resolve({ data: null, error: { message: 'nope' } }) }) }),
    }));
    await expect(getBaseCurrency()).rejects.toMatchObject({ message: 'nope' });
  });
});
