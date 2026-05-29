import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as api from './api/budget';

vi.mock('./api/budget');
vi.mock('./auth/AuthGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(), getUser: vi.fn() } },
}));

import App from './App';

const emptyBudget = {
  income: { projected: 0, actual: 0 },
  categories: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getBudget).mockResolvedValue(emptyBudget);
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
