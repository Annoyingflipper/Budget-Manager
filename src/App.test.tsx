import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as api from './api/budget';
import * as userPrefs from './api/userPrefs';

vi.mock('./api/budget');
vi.mock('./api/userPrefs', () => ({
  getLastSeenChangelogVersion: vi.fn().mockResolvedValue('1.5.1'),
  setLastSeenChangelogVersion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./auth/AuthGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(), getUser: vi.fn() } },
}));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));

import App from './App';

const emptyBudget = {
  income: { projected: 0, actual: 0 },
  categories: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getBudget).mockResolvedValue(emptyBudget);
  vi.mocked(userPrefs.getLastSeenChangelogVersion).mockResolvedValue('1.5.1');
  vi.mocked(userPrefs.setLastSeenChangelogVersion).mockResolvedValue(undefined);
});

describe('App', () => {
  it('initial month is listMonths()[0] when available', async () => {
    vi.mocked(api.listMonths).mockResolvedValue(['2026-06-01', '2026-05-01']);
    render(<App />);
    await waitFor(() => {
      expect(api.getBudget).toHaveBeenCalledWith('2026-06-01');
    });
    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('falls back to the current real-world month when listMonths is empty', async () => {
    vi.mocked(api.listMonths).mockResolvedValue([]);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    render(<App />);
    await waitFor(() => {
      expect(api.getBudget).toHaveBeenCalledWith(expected);
    });
  });
});
