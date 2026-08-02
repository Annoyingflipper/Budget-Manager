import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signedUrl = vi.fn();
vi.mock('../api/attachments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/attachments')>()),
  signedUrl: (...a: unknown[]) => signedUrl(...a),
}));

import AttachmentViewer from './AttachmentViewer';
import type { Attachment } from '../types';

function att(id: number, mime = 'image/jpeg'): Attachment {
  return {
    id,
    lineItemId: 1,
    storagePath: `user-1/1/${id}.jpg`,
    mimeType: mime,
    byteSize: 100,
    originalName: `receipt-${id}.jpg`,
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof AttachmentViewer>> = {}) {
  const props = {
    attachments: [att(1), att(2), att(3)],
    startIndex: 0,
    title: 'Groceries',
    subtitle: 'Bs. 30,000.00 · 01 May',
    onClose: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<AttachmentViewer {...props} />);
  return props;
}

beforeEach(() => {
  signedUrl.mockReset();
  signedUrl.mockImplementation((p: string) => Promise.resolve(`https://signed/${p}`));
});

describe('AttachmentViewer', () => {
  it('is a modal dialog', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('shows the expense name and amount for context', () => {
    setup();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText(/30,000/)).toBeInTheDocument();
  });

  it('renders the attachment at startIndex', async () => {
    setup({ startIndex: 1 });
    await waitFor(() =>
      expect(screen.getByTestId('viewer-image')).toHaveAttribute(
        'src', 'https://signed/user-1/1/2.jpg',
      ));
  });

  it('moves to the next attachment', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(screen.getByTestId('viewer-image')).toHaveAttribute(
        'src', 'https://signed/user-1/1/2.jpg',
      ));
  });

  it('wraps around from the last to the first', async () => {
    setup({ startIndex: 2 });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(screen.getByTestId('viewer-image')).toHaveAttribute(
        'src', 'https://signed/user-1/1/1.jpg',
      ));
  });

  it('wraps backwards from the first to the last', async () => {
    setup({ startIndex: 0 });
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    await waitFor(() =>
      expect(screen.getByTestId('viewer-image')).toHaveAttribute(
        'src', 'https://signed/user-1/1/3.jpg',
      ));
  });

  it('supports arrow keys', async () => {
    setup();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(screen.getByTestId('viewer-image')).toHaveAttribute(
        'src', 'https://signed/user-1/1/2.jpg',
      ));
  });

  it('hides the navigation when there is only one attachment', () => {
    setup({ attachments: [att(1)] });
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
  });

  it('shows the position within the set', () => {
    setup({ startIndex: 1 });
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('2 / 3');
  });

  it('closes on Escape', () => {
    const props = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', () => {
    const props = setup();
    fireEvent.click(screen.getByTestId('viewer-backdrop'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('does not close when the panel itself is clicked', () => {
    const props = setup();
    fireEvent.click(screen.getByTestId('viewer-panel'));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog on open', async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
  });

  it('deletes the current attachment after confirming', () => {
    const props = setup({ startIndex: 1 });
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(props.onDelete).toHaveBeenCalledWith(att(2));
  });

  it('does not delete without confirmation', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  // A PDF cannot render inline; offer to open it instead of showing a broken image.
  it('offers a PDF as a link rather than an image', async () => {
    setup({ attachments: [att(9, 'application/pdf')] });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /open pdf/i })).toBeInTheDocument());
    expect(screen.queryByTestId('viewer-image')).toBeNull();
  });

  it('renders nothing when there are no attachments', () => {
    const { container } = render(
      <AttachmentViewer
        attachments={[]} startIndex={0} title="x" subtitle="y"
        onClose={vi.fn()} onDelete={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
