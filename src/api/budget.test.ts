import { describe, it, expect, vi, beforeEach } from 'vitest';

type Call = { kind: string; args: unknown[] };
const calls: Call[] = [];

function builder(terminalData: unknown = []) {
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = chain;
  const methods = ['select', 'eq', 'order', 'single', 'maybeSingle'];
  for (const m of methods) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ kind: m, args });
      if (m === 'single' || m === 'maybeSingle') {
        return Promise.resolve({ data: terminalData, error: null });
      }
      return proxy;
    };
  }
  return proxy;
}

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => { calls.push({ kind: 'from', args }); return fromMock(...args); },
    rpc: (...args: unknown[]) => { calls.push({ kind: 'rpc', args }); return rpcMock(...args); },
  },
}));

import { getBudget, listMonths, rolloverMonth, getExportRows, deleteMonth } from './budget';

beforeEach(() => {
  calls.length = 0;
  fromMock.mockReset();
  rpcMock.mockReset();
});

describe('api/budget', () => {
  it('getBudget filters income and line_items by period_month', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'income') return builder({ projected: 0, actual: 0 });
      if (table === 'categories') {
        const b = builder([]);
        (b as { order: (...a: unknown[]) => unknown }).order = (...args: unknown[]) => {
          calls.push({ kind: 'order', args });
          return Promise.resolve({ data: [], error: null });
        };
        return b;
      }
      if (table === 'line_items') {
        const b = builder([]);
        (b as { order: (...a: unknown[]) => unknown }).order = (...args: unknown[]) => {
          calls.push({ kind: 'order', args });
          return Promise.resolve({ data: [], error: null });
        };
        return b;
      }
      return builder();
    });

    await getBudget('2026-06-01');

    const eqCalls = calls.filter((c) => c.kind === 'eq');
    expect(eqCalls).toContainEqual({ kind: 'eq', args: ['period_month', '2026-06-01'] });
    expect(eqCalls.filter((c) => c.args[0] === 'period_month').length).toBe(2);
  });

  it('rolloverMonth issues the rollover_month RPC with the right args', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await rolloverMonth('2026-06-01', '2026-07-01');
    expect(calls.find((c) => c.kind === 'rpc')).toEqual({
      kind: 'rpc',
      args: ['rollover_month', { from_month: '2026-06-01', to_month: '2026-07-01' }],
    });
  });

  it('listMonths returns distinct period_month strings sorted descending', async () => {
    fromMock.mockImplementation((table: string) => {
      const b = builder();
      (b as { order: (...a: unknown[]) => unknown }).order = () =>
        Promise.resolve({
          data: table === 'income'
            ? [{ period_month: '2026-06-01' }]
            : [{ period_month: '2026-06-01' }, { period_month: '2026-05-01' }],
          error: null,
        });
      return b;
    });
    const months = await listMonths();
    expect(months).toEqual(['2026-06-01', '2026-05-01']);
  });

  it('deleteMonth issues the delete_month RPC with the target month', async () => {
    rpcMock.mockResolvedValue({ error: null });
    await deleteMonth('2026-07-01');
    expect(calls).toContainEqual({
      kind: 'rpc',
      args: ['delete_month', { target_month: '2026-07-01' }],
    });
  });

  it('deleteMonth throws when the RPC returns an error', async () => {
    rpcMock.mockResolvedValue({ error: new Error('cannot delete current or past months') });
    await expect(deleteMonth('2026-06-01')).rejects.toThrow('cannot delete current or past months');
  });

  it('getExportRows joins line items to category names across all months', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'categories') {
        const b = builder();
        (b as { eq: (...a: unknown[]) => unknown }).eq = () =>
          Promise.resolve({
            data: [
              { id: 1, name: 'Food' },
              { id: 2, name: 'Rent' },
            ],
            error: null,
          });
        return b;
      }
      if (table === 'line_items') {
        const b = builder();
        (b as { order: (...a: unknown[]) => unknown }).order = () =>
          Promise.resolve({
            data: [
              { period_month: '2026-05-01', category_id: 1, name: 'Groceries', projected: 400, actual: 380 },
              { period_month: '2026-06-01', category_id: 2, name: 'Apartment', projected: 1650, actual: 1650 },
            ],
            error: null,
          });
        return b;
      }
      return builder();
    });

    const rows = await getExportRows();
    expect(rows).toEqual([
      { month: '2026-05-01', category: 'Food', item: 'Groceries', projected: 400, actual: 380 },
      { month: '2026-06-01', category: 'Rent', item: 'Apartment', projected: 1650, actual: 1650 },
    ]);
  });
});
