import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toolbar from './Toolbar';

function renderToolbar(overrides: Partial<React.ComponentProps<typeof Toolbar>> = {}) {
  const props = {
    selectedMonth: '2026-06-01',
    latestMonth: '2026-06-01' as string | null,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onRollover: vi.fn(),
    canDelete: false,
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe('Toolbar', () => {
  it('shows the selected month', () => {
    renderToolbar({ selectedMonth: '2026-06-01' });
    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('steps backwards', async () => {
    const user = userEvent.setup();
    const props = renderToolbar();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(props.onPrev).toHaveBeenCalled();
  });

  it('offers rollover on the latest month, naming the month it would start', () => {
    renderToolbar({ selectedMonth: '2026-06-01', latestMonth: '2026-06-01' });
    expect(screen.getByRole('button', { name: 'Start July 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument();
  });

  it('offers forward navigation when a later month already exists', () => {
    renderToolbar({ selectedMonth: '2026-05-01', latestMonth: '2026-06-01' });
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Start / })).not.toBeInTheDocument();
  });

  it('hides delete unless the month is deletable', () => {
    renderToolbar({ canDelete: false });
    expect(screen.queryByRole('button', { name: 'Delete this month' })).not.toBeInTheDocument();
  });

  it('deletes when allowed', async () => {
    const user = userEvent.setup();
    const props = renderToolbar({ canDelete: true });
    await user.click(screen.getByRole('button', { name: 'Delete this month' }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it('carries the testid the E2E page object scopes its month locators to', () => {
    // e2e/components/HeaderComponent.ts narrows to this element. Without it,
    // monthLabel's /^[A-Z][a-z]+ \d{4}$/ goes document-wide and collides with
    // the bare month <p> on the Insights page.
    const { container } = render(<Toolbar {...{ selectedMonth: '2026-06-01', latestMonth: '2026-06-01', onPrev: vi.fn(), onNext: vi.fn(), onRollover: vi.fn(), canDelete: false, onDelete: vi.fn() }} />);
    expect(container.querySelector('[data-testid="month-toolbar"]')).not.toBeNull();
  });
});
