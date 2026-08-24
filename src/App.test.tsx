import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as api from './api/budget';
import * as userPrefs from './api/userPrefs';
import * as accountsApi from './api/accounts';
import * as ratesApi from './api/rates';

vi.mock('./api/budget');
vi.mock('./api/userPrefs', () => ({
  getLastSeenChangelogVersion: vi.fn().mockResolvedValue('1.5.1'),
  setLastSeenChangelogVersion: vi.fn().mockResolvedValue(undefined),
  getBaseCurrency: vi.fn().mockResolvedValue('USD'),
  getPreferences: vi.fn().mockResolvedValue({ theme: 'peach', mode: 'light' }),
  updatePreferences: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./api/accounts', () => ({
  listAccounts: vi.fn().mockResolvedValue([]),
}));
vi.mock('./api/rates', () => ({
  listRates: vi.fn().mockResolvedValue([]),
  ensureTodayRates: vi.fn().mockResolvedValue([]),
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
  // resetAllMocks wipes the factory defaults above, so re-establish them here.
  vi.mocked(userPrefs.getBaseCurrency).mockResolvedValue('USD');
  vi.mocked(userPrefs.getPreferences).mockResolvedValue({ theme: 'peach', mode: 'light' });
  vi.mocked(userPrefs.updatePreferences).mockResolvedValue(undefined);
  vi.mocked(accountsApi.listAccounts).mockResolvedValue([]);
  vi.mocked(ratesApi.listRates).mockResolvedValue([]);
  vi.mocked(ratesApi.ensureTodayRates).mockResolvedValue([]);
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

  it('navigates to the accounts page from the header', async () => {
    vi.mocked(api.listMonths).mockResolvedValue(['2026-06-01']);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /accounts/i }));
    expect(await screen.findByRole('heading', { name: 'Accounts' })).toBeInTheDocument();
  });

  it('does not render the total-available card when there are no accounts', async () => {
    vi.mocked(api.listMonths).mockResolvedValue(['2026-06-01']);
    render(<App />);
    await screen.findByTestId('projected-balance');
    expect(screen.queryByTestId('total-available-card')).toBeNull();
  });
});
