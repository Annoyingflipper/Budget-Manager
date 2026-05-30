import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangelogModal from './ChangelogModal';
import type { ChangelogEntry } from '../changelog';

const entry: ChangelogEntry = {
  version: '1.5.1',
  date: '2026-05-30',
  title: 'Polish',
  highlights: ['First bullet.', 'Second bullet.'],
};

beforeEach(() => { vi.resetAllMocks(); });

describe('ChangelogModal', () => {
  it('renders the entry title, version, and each highlight as a bullet', () => {
    render(<ChangelogModal entry={entry} onDismiss={vi.fn()} />);
    expect(screen.getByText(/what's new in v1.5.1/i)).toBeInTheDocument();
    expect(screen.getByText('Polish')).toBeInTheDocument();
    expect(screen.getByText('First bullet.')).toBeInTheDocument();
    expect(screen.getByText('Second bullet.')).toBeInTheDocument();
  });

  it('clicking Got it calls onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<ChangelogModal entry={entry} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop calls onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<ChangelogModal entry={entry} onDismiss={onDismiss} />);
    await user.click(screen.getByTestId('changelog-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
