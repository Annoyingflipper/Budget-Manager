import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  // React logs caught render errors to console.error (twice, in dev). That
  // is expected noise for these tests, not a real failure — silence it so
  // the test output stays pristine.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders the fallback when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(
      screen.getByText('Something went wrong. Reload to get the latest version.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });

  it('reloads the page when the button is clicked', () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    // jsdom's window.location.reload is not implementable directly; replace
    // the whole object for the duration of this test.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    screen.getByRole('button', { name: 'Reload' }).click();
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
