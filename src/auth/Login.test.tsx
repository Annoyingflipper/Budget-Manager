import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Login from './Login';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Login', () => {
  // Deliberately no <ThemeProvider> here. In App.tsx, ThemeProvider is
  // mounted *inside* AuthGate, so Login renders outside it in the real app.
  // If Wordmark (or MesadaMark underneath it) ever starts calling
  // useTheme(), this test — not a screenshot, not a manual smoke test —
  // is what catches it before it reaches the live sign-in page. Do not
  // "fix" this by wrapping it in a ThemeProvider.
  it('renders the Mesada wordmark without a ThemeProvider', () => {
    render(<Login onSwitch={vi.fn()} />);
    expect(screen.getByText('Mesada')).toBeInTheDocument();
  });
});
