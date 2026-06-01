import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';
import { ThemeProvider } from '../theme/ThemeProvider';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

function renderHeader(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props = {
    selectedMonth: '2026-06-01',
    latestMonth: '2026-06-01' as string | null,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onRollover: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenInsights: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider>
      <Header {...props} />
    </ThemeProvider>,
  );
  return props;
}

beforeEach(() => { vi.resetAllMocks(); });

describe('Header', () => {
  it('renders the month label for the selected month', () => {
    renderHeader({ selectedMonth: '2026-06-01' });
    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('clicking the back arrow calls onPrev', async () => {
    const user = userEvent.setup();
    const props = renderHeader();
    await user.click(screen.getByLabelText('Previous month'));
    expect(props.onPrev).toHaveBeenCalledTimes(1);
  });

  it('shows "Start July 2026" when selectedMonth equals latestMonth and clicking calls onRollover', async () => {
    const user = userEvent.setup();
    const props = renderHeader({ selectedMonth: '2026-06-01', latestMonth: '2026-06-01' });
    const startButton = screen.getByRole('button', { name: /start july 2026/i });
    await user.click(startButton);
    expect(props.onRollover).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('calls onOpenInsights when the Insights button is clicked', () => {
    const onOpenInsights = vi.fn();
    render(
      <ThemeProvider>
        <Header
          selectedMonth="2026-06-01"
          latestMonth="2026-06-01"
          onPrev={() => {}}
          onNext={() => {}}
          onRollover={() => {}}
          onOpenSettings={() => {}}
          onOpenInsights={onOpenInsights}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('📊 Insights'));
    expect(onOpenInsights).toHaveBeenCalledTimes(1);
  });
});
