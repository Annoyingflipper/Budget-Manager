import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftRow from './DraftRow';

beforeEach(() => { vi.resetAllMocks(); });

function setup() {
  const onCommit = vi.fn();
  const onDiscard = vi.fn();
  render(
    <div>
      <DraftRow onCommit={onCommit} onDiscard={onDiscard} />
      <button>elsewhere</button>
    </div>
  );
  return { onCommit, onDiscard };
}

describe('DraftRow', () => {
  it('commits with typed values when focus leaves the row', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    await user.type(screen.getByPlaceholderText('Item name'), 'Claude');
    await user.tab(); // -> projected
    await user.clear(screen.getByLabelText('Projected'));
    await user.type(screen.getByLabelText('Projected'), '20');
    await user.tab(); // -> actual
    await user.clear(screen.getByLabelText('Actual'));
    await user.type(screen.getByLabelText('Actual'), '22');
    await user.tab(); // -> elsewhere
    expect(onCommit).toHaveBeenCalledWith({ name: 'Claude', projected: 20, actual: 22 });
  });

  it('discards on focus-out when name is empty', async () => {
    const user = userEvent.setup();
    const { onCommit, onDiscard } = setup();
    await user.click(screen.getByPlaceholderText('Item name'));
    await user.tab();
    await user.tab();
    await user.tab(); // -> elsewhere
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
  });

  it('commits on Enter from any input', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    await user.type(screen.getByPlaceholderText('Item name'), 'Netflix');
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith({ name: 'Netflix', projected: 0, actual: 0 });
  });

  it('discards on Escape', async () => {
    const user = userEvent.setup();
    const { onCommit, onDiscard } = setup();
    await user.type(screen.getByPlaceholderText('Item name'), 'Half typed');
    await user.keyboard('{Escape}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
  });
});
