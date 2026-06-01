import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectedVsActualChart from './ProjectedVsActualChart';
import type { CategoryTotal } from '../types';

const totals: CategoryTotal[] = [
  { id: 1, name: 'Food', icon: '🍔', projected: 600, actual: 700 }, // over budget
  { id: 2, name: 'Rent', icon: '🏠', projected: 1650, actual: 1650 }, // on budget
  { id: 3, name: 'Gym', icon: '🏋️', projected: 0, actual: 0 }, // omitted
];

describe('ProjectedVsActualChart', () => {
  it('renders a row per category that has any projected or actual', () => {
    render(<ProjectedVsActualChart totals={totals} />);
    expect(screen.getByText('🍔 Food')).toBeInTheDocument();
    expect(screen.getByText('🏠 Rent')).toBeInTheDocument();
    expect(screen.queryByText('🏋️ Gym')).not.toBeInTheDocument();
  });

  it('colors the over-budget amount with text-negative and on-budget with text-positive', () => {
    render(<ProjectedVsActualChart totals={totals} />);
    const food = screen.getByText('🍔 Food').closest('div')!;
    expect(food.querySelector('.text-negative')).not.toBeNull();
    const rent = screen.getByText('🏠 Rent').closest('div')!;
    expect(rent.querySelector('.text-positive')).not.toBeNull();
  });

  it('shows an empty-state message when nothing to chart', () => {
    render(<ProjectedVsActualChart totals={[{ id: 9, name: 'X', icon: '❓', projected: 0, actual: 0 }]} />);
    expect(screen.getByText('No spending to chart yet.')).toBeInTheDocument();
  });
});
