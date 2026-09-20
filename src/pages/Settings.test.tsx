import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signOut = vi.fn();

function tableBuilder(data: unknown) {
  // Thenable builder: chain calls return the same object; awaiting it resolves
  // to { data, error: null }, so any `.select().eq().order()`-shaped chain
  // CategoriesEditor issues awaits cleanly.
  const b: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'order', 'delete'];
  for (const m of methods) {
    b[m] = (..._args: unknown[]) => b;
  }
  (b as { then: (resolve: (val: { data: unknown; error: null }) => void) => void }).then =
    (resolve) => resolve({ data, error: null });
  return b;
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }),
      signOut: () => signOut(),
    },
    from: vi.fn((table: string) => tableBuilder(table === 'categories' ? [] : [])),
  },
}));

const setMode = vi.fn();
const setTheme = vi.fn();
vi.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'peach', mode: 'light', setTheme, setMode }),
}));

const getBaseCurrency = vi.fn();
const setBaseCurrency = vi.fn();
vi.mock('../api/userPrefs', () => ({
  getBaseCurrency: (...a: unknown[]) => getBaseCurrency(...a),
  setBaseCurrency: (...a: unknown[]) => setBaseCurrency(...a),
}));

vi.mock('../api/categories', () => ({
  addCategory: vi.fn(),
  moveAndDeleteCategory: vi.fn(),
  reorderCategories: vi.fn(),
}));

import Settings from './Settings';

function renderSettings() {
  return render(
    <Settings onBack={vi.fn()} onCategoriesChanged={vi.fn()} onOpenChangelog={vi.fn()} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getBaseCurrency.mockResolvedValue('USD');
});

describe('Settings', () => {
  it('offers sign out, which is the only way a mobile user can log out', async () => {
    // TabBarNav has room for the four destinations and nothing else, so on a
    // phone this button is the sole exit. Do not remove it without giving the
    // tab bar somewhere else to put it.
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalled();
  });
});
