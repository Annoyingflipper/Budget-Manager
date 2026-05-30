import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Toast from './Toast';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message="Saved" type="success" onDismiss={vi.fn()} />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('calls onDismiss after timeoutMs', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" type="success" onDismiss={onDismiss} timeoutMs={1500} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
