import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CategoryBudgetBar from './CategoryBudgetBar';

describe('CategoryBudgetBar', () => {
  it('renders nothing for an empty (never-budgeted) category', () => {
    const { container } = render(
      <CategoryBudgetBar categoryId={1} categoryName="Other" projected={0} actual={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an under-budget bar with positive fill and percent label', () => {
    render(<CategoryBudgetBar categoryId={2} categoryName="Entertainment" projected={30} actual={25} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('data-state', 'under');
    expect(bar).toHaveAttribute('aria-valuenow', '83');
    expect(bar).toHaveAttribute('aria-label', 'Entertainment budget: 83% of projected spent');
    expect(bar.querySelector('.bg-positive')).not.toBeNull();
  });

  it('renders a near-budget bar with the warning fill', () => {
    render(<CategoryBudgetBar categoryId={3} categoryName="Food" projected={100} actual={95} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('data-state', 'near');
    expect(bar.querySelector('.bg-warning')).not.toBeNull();
  });

  it('renders an over-budget bar clamped to 100% with negative fill and over-by label', () => {
    render(<CategoryBudgetBar categoryId={4} categoryName="Services" projected={130} actual={135} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('data-state', 'over');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-label', 'Services budget: over by $5.00');
    expect(bar.querySelector('.bg-negative')).not.toBeNull();
  });
});
