import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthDelta from './MonthDelta';
import type { MonthDelta as MonthDeltaT } from '../types';

describe('MonthDelta', () => {
  it('shows a no-prior-month message when hasPrior is false', () => {
    render(<MonthDelta delta={{ hasPrior: false }} />);
    expect(screen.getByText('No prior month to compare.')).toBeInTheDocument();
  });

  it('renders up (negative color), down (positive color), and equal rows', () => {
    const delta: MonthDeltaT = {
      hasPrior: true,
      rows: [
        { id: 1, name: 'Food', icon: '🍔', currentActual: 700, prevActual: 500, delta: 200 },
        { id: 2, name: 'Gas', icon: '⛽', currentActual: 90, prevActual: 150, delta: -60 },
        { id: 3, name: 'Rent', icon: '🏠', currentActual: 1650, prevActual: 1650, delta: 0 },
      ],
    };
    render(<MonthDelta delta={delta} />);

    const food = screen.getByText('🍔 Food').closest('li')!;
    expect(food.textContent).toContain('▲');
    expect(food.querySelector('.text-negative')).not.toBeNull();

    const gas = screen.getByText('⛽ Gas').closest('li')!;
    expect(gas.textContent).toContain('▼');
    expect(gas.querySelector('.text-positive')).not.toBeNull();

    const rent = screen.getByText('🏠 Rent').closest('li')!;
    expect(rent.textContent).toContain('same');
  });
});
