import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Signup from './Signup';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Signup', () => {
  // Deliberately no <ThemeProvider> here. In App.tsx, ThemeProvider is
  // mounted *inside* AuthGate, so Signup renders outside it in the real
  // app. If Wordmark (or MesadaMark underneath it) ever starts calling
  // useTheme(), this test — not a screenshot, not a manual smoke test —
  // is what catches it before it reaches the live sign-up page. Do not
  // "fix" this by wrapping it in a ThemeProvider.
  it('renders the Mesada wordmark without a ThemeProvider', () => {
    render(<Signup onSwitch={vi.fn()} />);
    expect(screen.getByText('Mesada')).toBeInTheDocument();
  });
});
