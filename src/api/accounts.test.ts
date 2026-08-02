import { describe, it, expect, vi, beforeEach } from 'vitest';

type Call = { kind: string; args: unknown[] };
const calls: Call[] = [];

// `order` (list queries) and `single` (insert ... returning) need separate
// fixtures: addAccount calls listAccounts internally to derive display_order,
// so one builder serves both shapes in a single test.
function builder(listData: unknown = [], singleData: unknown = null) {
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = chain;
  for (const m of ['select', 'eq', 'insert', 'update', 'delete', 'single']) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ kind: m, args });
      if (m === 'single') return Promise.resolve({ data: singleData, error: null });
      return proxy;
    };
  }
  chain.order = (...args: unknown[]) => {
    calls.push({ kind: 'order', args });
    return Promise.resolve({ data: listData, error: null });
  };
  return proxy;
}

const fromMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => { calls.push({ kind: 'from', args }); return fromMock(...args); },
  },
}));

import { listAccounts, addAccount, updateAccount, deleteAccount } from './accounts';

beforeEach(() => { calls.length = 0; fromMock.mockReset(); });

describe('api/accounts', () => {
  it('listAccounts scopes to the user, orders by display_order, and coerces numerics', async () => {
    fromMock.mockImplementation(() => builder([
      { id: 1, name: 'Chase', icon: '🏦', currency: 'USD', balance: '2430.18', display_order: 1 },
    ]));

    const result = await listAccounts();

    expect(calls.find((c) => c.kind === 'from')?.args[0]).toBe('accounts');
    expect(calls.find((c) => c.kind === 'eq')?.args).toEqual(['user_id', 'user-1']);
    expect(calls.find((c) => c.kind === 'order')?.args[0]).toBe('display_order');
    // PostgREST returns numeric as a string; it must not leak into the UI.
    expect(result[0].balance).toBe(2430.18);
    expect(typeof result[0].balance).toBe('number');
  });

  it('addAccount stamps user_id and returns the created row', async () => {
    fromMock.mockImplementation(() => builder(
      // two existing accounts, so the new one must land at display_order 3
      [
        { id: 1, name: 'A', icon: '🏦', currency: 'USD', balance: '0', display_order: 1 },
        { id: 2, name: 'B', icon: '🏦', currency: 'USD', balance: '0', display_order: 2 },
      ],
      { id: 7, name: 'Revolut', icon: '💳', currency: 'EUR', balance: '1800.00', display_order: 3 },
    ));

    const created = await addAccount({ name: 'Revolut', icon: '💳', currency: 'EUR', balance: 1800 });

    const insert = calls.find((c) => c.kind === 'insert');
    expect((insert?.args[0] as Record<string, unknown>).user_id).toBe('user-1');
    expect((insert?.args[0] as Record<string, unknown>).currency).toBe('EUR');
    // display_order continues from the highest existing one
    expect((insert?.args[0] as Record<string, unknown>).display_order).toBe(3);
    expect(created).toEqual({
      id: 7, name: 'Revolut', icon: '💳', currency: 'EUR', balance: 1800, display_order: 3,
    });
  });

  it('updateAccount sends only the patched fields plus updated_at', async () => {
    fromMock.mockImplementation(() => {
      const b = builder() as Record<string, unknown>;
      b.eq = (...args: unknown[]) => {
        calls.push({ kind: 'eq', args });
        return Promise.resolve({ error: null });
      };
      return b;
    });

    await updateAccount(4, { balance: 99.5 });

    const patch = calls.find((c) => c.kind === 'update')?.args[0] as Record<string, unknown>;
    expect(patch.balance).toBe(99.5);
    expect(patch.name).toBeUndefined();
    expect(patch.updated_at).toBeTruthy();
    expect(calls.find((c) => c.kind === 'eq')?.args).toEqual(['id', 4]);
  });

  it('deleteAccount deletes by id', async () => {
    fromMock.mockImplementation(() => {
      const b = builder() as Record<string, unknown>;
      b.eq = (...args: unknown[]) => {
        calls.push({ kind: 'eq', args });
        return Promise.resolve({ error: null });
      };
      return b;
    });

    await deleteAccount(9);

    expect(calls.some((c) => c.kind === 'delete')).toBe(true);
    expect(calls.find((c) => c.kind === 'eq')?.args).toEqual(['id', 9]);
  });

  it('throws when Supabase returns an error', async () => {
    fromMock.mockImplementation(() => {
      const b = builder() as Record<string, unknown>;
      b.order = () => Promise.resolve({ data: null, error: { message: 'boom' } });
      return b;
    });

    await expect(listAccounts()).rejects.toMatchObject({ message: 'boom' });
  });
});
