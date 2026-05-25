import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeProvider';
import * as prefsApi from '../api/preferences';

vi.mock('../api/preferences');

function Probe() {
  const { theme, mode, setTheme, setMode } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setTheme('sage')}>sage</button>
      <button onClick={() => setMode('dark')}>dark</button>
    </div>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  document.documentElement.setAttribute('data-theme', 'peach');
  document.documentElement.setAttribute('data-mode', 'light');
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-mode');
});

describe('ThemeProvider', () => {
  it('renders children with default peach/light when no preferences loaded yet', () => {
    vi.mocked(prefsApi.getPreferences).mockReturnValue(new Promise(() => {}));
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('peach');
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('loads preferences from API and applies them', async () => {
    vi.mocked(prefsApi.getPreferences).mockResolvedValue({ theme: 'lavender', mode: 'dark' });
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await vi.waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('lavender');
      expect(screen.getByTestId('mode').textContent).toBe('dark');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('lavender');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
  });

  it('setTheme updates context, html attribute, and persists via API', async () => {
    vi.mocked(prefsApi.getPreferences).mockResolvedValue({ theme: 'peach', mode: 'light' });
    vi.mocked(prefsApi.updatePreferences).mockResolvedValue();
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await vi.waitFor(() => expect(screen.getByTestId('theme').textContent).toBe('peach'));
    await user.click(screen.getByText('sage'));
    expect(screen.getByTestId('theme').textContent).toBe('sage');
    expect(document.documentElement.getAttribute('data-theme')).toBe('sage');
    await vi.waitFor(() => {
      expect(prefsApi.updatePreferences).toHaveBeenCalledWith({ theme: 'sage' });
    });
  });

  it('reverts on persistence failure', async () => {
    // We intentionally don't assert the intermediate optimistic 'sage' state:
    // when updatePreferences rejects synchronously (as the mock does here),
    // React 18 can batch the optimistic setPrefs(next) and the catch's
    // setPrefs(previous) into a single commit, skipping the intermediate
    // render. In real usage with network latency, the optimistic state IS
    // visible; what we assert here is what the user ultimately observes —
    // the revert plus a recorded persistence attempt.
    vi.mocked(prefsApi.getPreferences).mockResolvedValue({ theme: 'peach', mode: 'light' });
    vi.mocked(prefsApi.updatePreferences).mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await vi.waitFor(() => expect(screen.getByTestId('theme').textContent).toBe('peach'));
    await user.click(screen.getByText('sage'));
    await vi.waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('peach');
      expect(prefsApi.updatePreferences).toHaveBeenCalledWith({ theme: 'sage' });
    });
  });
});
