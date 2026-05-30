import { describe, it, expect, vi, beforeEach } from 'vitest';

type Call = { kind: string; args: unknown[] };
const calls: Call[] = [];

function builder(terminalData: unknown = []) {
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = chain;
  const methods = ['select', 'eq', 'order', 'single', 'maybeSingle', 'insert', 'update', 'limit'];
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

import {
  addCategory,
  renameCategory,
  setCategoryIcon,
  moveAndDeleteCategory,
  reorderCategories,
} from './categories';

beforeEach(() => {
  calls.length = 0;
  fromMock.mockReset();
  rpcMock.mockReset();
});

describe('api/categories', () => {
  it('addCategory inserts row with user_id + name + icon + computed display_order', async () => {
    // First call: SELECT max(display_order) -> returns 8.
    // Second call: INSERT row.
    fromMock.mockImplementationOnce(() => {
      const b = builder();
      (b as { order: (...a: unknown[]) => unknown }).order = () =>
        Promise.resolve({ data: [{ display_order: 8 }], error: null });
      return b;
    });
    fromMock.mockImplementationOnce(() =>
      builder({ id: 99, name: 'Vacation', display_order: 9, icon: '🏝' }),
    );

    const created = await addCategory('Vacation', '🏝');

    const insertCall = calls.find((c) => c.kind === 'insert');
    expect(insertCall).toEqual({
      kind: 'insert',
      args: [{ user_id: 'user-1', name: 'Vacation', icon: '🏝', display_order: 9 }],
    });
    expect(created).toEqual({ id: 99, name: 'Vacation', display_order: 9, icon: '🏝' });
  });

  it('renameCategory updates name by id', async () => {
    fromMock.mockImplementation(() => builder());
    await renameCategory(42, 'Mortgage');
    expect(calls.find((c) => c.kind === 'update')).toEqual({ kind: 'update', args: [{ name: 'Mortgage' }] });
    expect(calls.find((c) => c.kind === 'eq')).toEqual({ kind: 'eq', args: ['id', 42] });
  });

  it('setCategoryIcon updates icon by id', async () => {
    fromMock.mockImplementation(() => builder());
    await setCategoryIcon(42, '🏠');
    expect(calls.find((c) => c.kind === 'update')).toEqual({ kind: 'update', args: [{ icon: '🏠' }] });
    expect(calls.find((c) => c.kind === 'eq')).toEqual({ kind: 'eq', args: ['id', 42] });
  });

  it('moveAndDeleteCategory issues move_and_delete_category RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await moveAndDeleteCategory(1, 2);
    expect(calls.find((c) => c.kind === 'rpc')).toEqual({
      kind: 'rpc',
      args: ['move_and_delete_category', { src_id: 1, dst_id: 2 }],
    });
  });

  it('reorderCategories issues reorder_categories RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await reorderCategories([3, 1, 2]);
    expect(calls.find((c) => c.kind === 'rpc')).toEqual({
      kind: 'rpc',
      args: ['reorder_categories', { ordered_ids: [3, 1, 2] }],
    });
  });
});
