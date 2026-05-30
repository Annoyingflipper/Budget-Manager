import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmojiPicker from './EmojiPicker';

beforeEach(() => { vi.resetAllMocks(); });

describe('EmojiPicker', () => {
  it('clicking a grid emoji calls onPick with that emoji', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<EmojiPicker onPick={onPick} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '🏠' }));
    expect(onPick).toHaveBeenCalledWith('🏠');
  });

  it('typing an emoji in the freeform input and pressing Enter calls onPick', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<EmojiPicker onPick={onPick} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Or paste any emoji');
    await user.type(input, '🎯{Enter}');
    expect(onPick).toHaveBeenCalledWith('🎯');
  });
});
