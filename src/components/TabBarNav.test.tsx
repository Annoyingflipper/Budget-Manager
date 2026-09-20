import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBarNav from './TabBarNav';
import { NAV_ITEMS } from '../navigation';

describe('TabBarNav', () => {
  it('is a labelled navigation landmark', () => {
    render(<TabBarNav page="budget" onNavigate={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('renders exactly the same destinations as the sidebar', () => {
    render(<TabBarNav page="budget" onNavigate={vi.fn()} />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button')).toHaveLength(NAV_ITEMS.length);
  });

  it('marks only the current page with aria-current', () => {
    render(<TabBarNav page="settings" onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Budget' })).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate with the chosen page', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<TabBarNav page="budget" onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: 'Insights' }));
    expect(onNavigate).toHaveBeenCalledWith('insights');
  });
});
