import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DateCell from './DateCell';

const CLEAR = { ariaLabel: 'Clear due date', glyph: '✕' };

describe('DateCell', () => {
  it('renders the empty label when there is no value', () => {
    render(
      <DateCell value={null} onSave={vi.fn()} label="Due date"
        empty={{ label: '＋ due', ariaLabel: 'Set due date' }} clear={CLEAR} />,
    );
    expect(screen.getByRole('button', { name: 'Set due date' })).toHaveTextContent('＋ due');
  });

  it('calls empty.onClick instead of opening the input when a handler is given', async () => {
    const onClick = vi.fn();
    render(
      <DateCell value={null} onSave={vi.fn()} label="Paid date"
        empty={{ label: 'Mark paid', ariaLabel: 'Mark paid', onClick }} clear={CLEAR} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Paid date')).not.toBeInTheDocument();
  });

  it('opens its own input when no empty.onClick is given', async () => {
    render(
      <DateCell value={null} onSave={vi.fn()} label="Due date"
        empty={{ label: '＋ due', ariaLabel: 'Set due date' }} clear={CLEAR} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Set due date' }));
    expect(screen.getByLabelText('Due date')).toBeInTheDocument();
  });

  it('shows the input when a value is set', () => {
    render(
      <DateCell value="2026-08-05" onSave={vi.fn()} label="Due date"
        empty={{ label: '＋ due', ariaLabel: 'Set due date' }} clear={CLEAR} />,
    );
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-08-05');
  });

  it('saves the typed date on blur', async () => {
    const onSave = vi.fn();
    render(
      <DateCell value="2026-08-05" onSave={onSave} label="Due date"
        empty={{ label: '＋ due', ariaLabel: 'Set due date' }} clear={CLEAR} />,
    );
    const input = screen.getByLabelText('Due date');
    await userEvent.clear(input);
    await userEvent.type(input, '2026-09-01');
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith('2026-09-01');
  });

  it('saves null when the clear affordance is used', async () => {
    const onSave = vi.fn();
    render(
      <DateCell value="2026-08-05" onSave={onSave} label="Due date"
        empty={{ label: '＋ due', ariaLabel: 'Set due date' }} clear={CLEAR} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear due date' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('applies the overdue tone to the input', () => {
    render(
      <DateCell value="2026-08-01" onSave={vi.fn()} label="Due date" tone="overdue"
        empty={{ label: '＋ due', ariaLabel: 'Set due date' }} clear={CLEAR} />,
    );
    expect(screen.getByLabelText('Due date').className).toContain('border-negative');
  });
});
