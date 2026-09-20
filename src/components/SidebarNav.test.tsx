import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SidebarNav from './SidebarNav';
import { NAV_ITEMS } from '../navigation';

const signOut = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: () => signOut() } } }));

const setMode = vi.fn();
vi.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'peach', mode: 'light', setTheme: vi.fn(), setMode }),
}));

beforeEach(() => { vi.clearAllMocks(); });

describe('SidebarNav', () => {
  it('is a labelled navigation landmark', () => {
    render(<SidebarNav page="budget" onNavigate={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('renders every destination as a button named by its label', () => {
    render(<SidebarNav page="budget" onNavigate={vi.fn()} />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
    }
  });

  it('marks only the current page with aria-current', () => {
    render(<SidebarNav page="insights" onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Insights' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Budget' })).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate with the chosen page', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<SidebarNav page="budget" onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: 'Accounts' }));
    expect(onNavigate).toHaveBeenCalledWith('accounts');
  });

  it('shows the wordmark', () => {
    render(<SidebarNav page="budget" onNavigate={vi.fn()} />);
    expect(screen.getByText('Mesada')).toBeInTheDocument();
  });

  it('toggles colour mode', async () => {
    const user = userEvent.setup();
    render(<SidebarNav page="budget" onNavigate={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Toggle color mode' }));
    expect(setMode).toHaveBeenCalledWith('dark');
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    render(<SidebarNav page="budget" onNavigate={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('carries the sticky/viewport-height classes that keep it pinned', () => {
    // Cheap guard only: jsdom has no layout engine, so this can only check
    // that the classes are present on the element — it cannot verify that
    // the nav actually stays on screen, or that top-4 still matches
    // AppShell's p-4. e2e/specs/app-shell.e2e.ts is the real guard for that;
    // it asserts (with a real browser layout engine) that the "Log out"
    // button is in the viewport both at load and after scrolling.
    render(<SidebarNav page="budget" onNavigate={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.className).toContain('sticky');
    expect(nav.className).toContain('top-4');
    expect(nav.className).toContain('h-[calc(100vh-2rem)]');
    expect(nav.className).toContain('overflow-y-auto');
  });

  it('reaches every destination by keyboard alone', async () => {
    // The spec requires keyboard navigability. Native <button>s give this for
    // free — this test exists so a later refactor to divs cannot silently
    // take it away.
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<SidebarNav page="budget" onNavigate={onNavigate} />);
    const first = screen.getByRole('button', { name: NAV_ITEMS[0].label });
    first.focus();
    expect(first).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith(NAV_ITEMS[0].page);
  });
});
