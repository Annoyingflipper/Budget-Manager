import { useEffect, useRef, useState } from 'react';
import { signedUrl, MAX_PER_ITEM } from '../api/attachments';
import type { Attachment } from '../types';

type Props = {
  lineItemId: number;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onOpen: (index: number) => void;
  uploading: boolean;
  error: string | null;
};

function isImage(a: Attachment): boolean {
  return a.mimeType.startsWith('image/');
}

export default function AttachmentStrip({
  lineItemId, attachments, onUpload, onOpen, uploading, error,
}: Props) {
  const first = attachments[0];
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazily: a month of expenses should not fire dozens of signed-URL requests on
  // first paint, so only the first image of each row is fetched.
  useEffect(() => {
    let cancelled = false;
    setThumbUrl(null);
    if (!first || !isImage(first)) return;
    signedUrl(first.storagePath)
      .then((url) => { if (!cancelled) setThumbUrl(url); })
      .catch(() => { /* falls back to the document icon */ });
    return () => { cancelled = true; };
  }, [first]);

  const atLimit = attachments.length >= MAX_PER_ITEM;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {first && (
        thumbUrl ? (
          <button
            type="button"
            onClick={() => onOpen(0)}
            data-testid={`attachment-thumb-${lineItemId}`}
            aria-label={`View receipts for this expense (${attachments.length})`}
            className="shrink-0"
          >
            <img
              src={thumbUrl}
              alt=""
              loading="lazy"
              // If the object is gone or the URL has expired, fall back to the
              // document icon rather than showing a broken image.
              onError={() => setThumbUrl(null)}
              className="h-7 w-7 object-cover rounded border border-highlight"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(0)}
            data-testid={`attachment-doc-${lineItemId}`}
            aria-label={`View receipts for this expense (${attachments.length})`}
            className="shrink-0 text-sm"
          >
            📄
          </button>
        )
      )}

      {attachments.length > 1 && (
        <span data-testid={`attachment-count-${lineItemId}`} className="text-xs text-muted">
          ×{attachments.length}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        aria-label="Attach a receipt"
        disabled={uploading || atLimit}
        title={atLimit ? `Up to ${MAX_PER_ITEM} attachments per expense` : 'Attach a receipt'}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          if (inputRef.current) inputRef.current.value = '';
        }}
        className="block w-24 text-[10px] text-muted file:mr-1 file:rounded file:border-0
                   file:bg-bg file:px-1.5 file:py-0.5 file:text-[10px] file:text-muted
                   disabled:opacity-50"
      />

      {uploading && <span className="text-xs text-muted">Uploading…</span>}

      {error && (
        <span data-testid={`attachment-error-${lineItemId}`} className="text-xs text-negative">
          {error}
        </span>
      )}
    </div>
  );
}
