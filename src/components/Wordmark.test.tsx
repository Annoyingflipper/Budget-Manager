import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Wordmark from './Wordmark';

describe('Wordmark', () => {
  it('renders the app name', () => {
    render(<Wordmark />);
    expect(screen.getByText('Mesada')).toBeInTheDocument();
  });

  it('renders the mark alongside the name', () => {
    const { container } = render(<Wordmark />);
    expect(container.querySelectorAll('[data-coin]')).toHaveLength(3);
  });

  it('renders larger in the lg variant than the sm variant', () => {
    const { container: small } = render(<Wordmark size="sm" />);
    const { container: large } = render(<Wordmark size="lg" />);
    const smallSize = Number(small.querySelector('svg')?.getAttribute('width'));
    const largeSize = Number(large.querySelector('svg')?.getAttribute('width'));
    expect(largeSize).toBeGreaterThan(smallSize);
  });

  it('does not double up the accessible name', () => {
    // The visible text already names the app; the mark must stay decorative
    // so a screen reader does not announce "Mesada Mesada".
    const { container } = render(<Wordmark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a span by default, with "Mesada" as its accessible name', () => {
    render(<Wordmark />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    const name = screen.getByText('Mesada');
    expect(name.tagName).toBe('SPAN');
  });

  it('renders an h1 when as="h1", with "Mesada" as its accessible name', () => {
    render(<Wordmark as="h1" />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Mesada' });
    expect(heading).toBeInTheDocument();
  });
});
