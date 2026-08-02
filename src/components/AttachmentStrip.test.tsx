import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signedUrl = vi.fn();
vi.mock('../api/attachments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/attachments')>()),
  signedUrl: (...a: unknown[]) => signedUrl(...a),
}));

import AttachmentStrip from './AttachmentStrip';
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

function setup(overrides: Partial<React.ComponentProps<typeof AttachmentStrip>> = {}) {
  const props = {
    lineItemId: 1,
    attachments: [] as Attachment[],
    onUpload: vi.fn(),
    onOpen: vi.fn(),
    uploading: false,
    error: null as string | null,
    ...overrides,
  };
  render(<AttachmentStrip {...props} />);
  return props;
}

beforeEach(() => {
  signedUrl.mockReset();
  signedUrl.mockResolvedValue('https://signed/x.jpg');
});

describe('AttachmentStrip', () => {
  it('offers an add control when there are none', () => {
    setup();
    expect(screen.getByLabelText('Attach a receipt')).toBeInTheDocument();
    expect(screen.queryByTestId('attachment-count-1')).toBeNull();
  });

  it('shows a thumbnail for a single image', async () => {
    setup({ attachments: [att(1)] });
    await waitFor(() => expect(screen.getByTestId('attachment-thumb-1')).toBeInTheDocument());
    expect(signedUrl).toHaveBeenCalledWith('user-1/1/1.jpg');
  });

  it('shows a count when there are several', () => {
    setup({ attachments: [att(1), att(2), att(3)] });
    expect(screen.getByTestId('attachment-count-1')).toHaveTextContent('3');
  });

  it('opens the viewer when the thumbnail is clicked', async () => {
    const props = setup({ attachments: [att(1)] });
    await waitFor(() => expect(screen.getByTestId('attachment-thumb-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('attachment-thumb-1'));
    expect(props.onOpen).toHaveBeenCalledWith(0);
  });

  // A PDF has no preview; it must not render as a broken image.
  it('shows a document icon for a PDF rather than a thumbnail', () => {
    setup({ attachments: [att(1, 'application/pdf')] });
    expect(screen.getByTestId('attachment-doc-1')).toBeInTheDocument();
    expect(screen.queryByTestId('attachment-thumb-1')).toBeNull();
  });

  it('passes the chosen file up', () => {
    const props = setup();
    const input = screen.getByLabelText('Attach a receipt') as HTMLInputElement;
    const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onUpload).toHaveBeenCalledWith(file);
  });

  it('accepts images and PDFs only', () => {
    setup();
    const input = screen.getByLabelText('Attach a receipt') as HTMLInputElement;
    expect(input.accept).toBe('image/*,application/pdf');
  });

  // Including `capture` would force the camera and hide the photo library, which
  // is wrong when the proof is a screenshot already on the phone.
  it('does not force the camera on mobile', () => {
    setup();
    expect(screen.getByLabelText('Attach a receipt')).not.toHaveAttribute('capture');
  });

  it('disables adding while an upload is in flight', () => {
    setup({ uploading: true });
    expect(screen.getByLabelText('Attach a receipt')).toBeDisabled();
  });

  it('disables adding at the attachment limit', () => {
    setup({ attachments: Array.from({ length: 8 }, (_, i) => att(i + 1)) });
    expect(screen.getByLabelText('Attach a receipt')).toBeDisabled();
  });

  it('surfaces a rejection reason', () => {
    setup({ error: 'That file is 12.4 MB — the limit is 10 MB.' });
    expect(screen.getByTestId('attachment-error-1')).toHaveTextContent('12.4 MB');
  });

  it('falls back to a placeholder when the signed url fails', async () => {
    signedUrl.mockRejectedValue(new Error('nope'));
    setup({ attachments: [att(1)] });
    await waitFor(() => expect(screen.getByTestId('attachment-doc-1')).toBeInTheDocument());
  });
});
