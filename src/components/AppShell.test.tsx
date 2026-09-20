import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Controllable per test so both layouts are covered — the same pattern
// AccountRow.test.tsx uses, because setup.ts's matchMedia polyfill always
// reports desktop.
const viewport = { isMobile: false };
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => viewport.isMobile }));

vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'peach', mode: 'light', setTheme: vi.fn(), setMode: vi.fn() }),
}));

import AppShell from './AppShell';

beforeEach(() => { viewport.isMobile = false; });

describe('AppShell', () => {
  it('renders its children', () => {
    render(<AppShell page="budget" onNavigate={vi.fn()}><p>dashboard</p></AppShell>);
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('shows the sidebar on desktop, with sign out reachable', () => {
    render(<AppShell page="budget" onNavigate={vi.fn()}><p>x</p></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('shows the tab bar on mobile, without the sidebar-only controls', () => {
    viewport.isMobile = true;
    render(<AppShell page="budget" onNavigate={vi.fn()}><p>x</p></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    // The bar has room for destinations only; mode and sign out live in Settings.
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle color mode' })).not.toBeInTheDocument();
  });

  it('exposes exactly one navigation landmark in each layout', () => {
    // Two would make "skip to nav" ambiguous and confuse screen-reader users.
    const { unmount } = render(<AppShell page="budget" onNavigate={vi.fn()}><p>x</p></AppShell>);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    unmount();
    viewport.isMobile = true;
    render(<AppShell page="budget" onNavigate={vi.fn()}><p>x</p></AppShell>);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });
});
