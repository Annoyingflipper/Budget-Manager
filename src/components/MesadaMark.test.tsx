import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MesadaMark from './MesadaMark';

describe('MesadaMark', () => {
  it('renders an svg at the requested size', () => {
    const { container } = render(<MesadaMark size={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  it('draws three coin shapes', () => {
    const { container } = render(<MesadaMark />);
    expect(container.querySelectorAll('[data-coin]')).toHaveLength(3);
  });

  it('uses theme custom properties rather than hardcoded hex', () => {
    const { container } = render(<MesadaMark />);
    const markup = container.innerHTML;
    expect(markup).toContain('var(--');
    expect(markup).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('is hidden from assistive tech by default', () => {
    const { container } = render(<MesadaMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('exposes an accessible name when given a title', () => {
    render(<MesadaMark title="Mesada" />);
    expect(screen.getByRole('img', { name: 'Mesada' })).toBeInTheDocument();
  });

  it('applies a passed className', () => {
    const { container } = render(<MesadaMark className="shrink-0" />);
    expect(container.querySelector('svg')).toHaveClass('shrink-0');
  });
});
