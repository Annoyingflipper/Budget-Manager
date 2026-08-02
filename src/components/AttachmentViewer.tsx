import { useCallback, useEffect, useRef, useState } from 'react';
import { signedUrl } from '../api/attachments';
import type { Attachment } from '../types';

type Props = {
  attachments: Attachment[];
  startIndex: number;
  /** The expense this belongs to, so the receipt has context on screen. */
  title: string;
  subtitle: string;
  onClose: () => void;
  onDelete: (attachment: Attachment) => void;
};

export default function AttachmentViewer({
  attachments, startIndex, title, subtitle, onClose, onDelete,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [url, setUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  const count = attachments.length;
  const current = attachments[Math.min(index, Math.max(count - 1, 0))];

  const next = useCallback(() => {
    setConfirming(false);
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setConfirming(false);
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  // Remember where focus came from so it can be handed back on close.
  useEffect(() => {
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    if (count === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (count < 2) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [count, next, prev, onClose]);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!current) return;
    signedUrl(current.storagePath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { /* leaves the loading state, retried on reopen */ });
    return () => { cancelled = true; };
  }, [current]);

  if (count === 0) return null;

  const isImage = current.mimeType.startsWith('image/');

  return (
    <div
      data-testid="viewer-backdrop"
      onClick={onClose}
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Receipts for ${title}`}
        data-testid="viewer-panel"
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-xl p-4 max-w-3xl w-full max-h-full overflow-auto outline-none"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="font-extrabold text-sm truncate">{title}</div>
            <div className="text-muted text-xs">{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-text text-lg shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2">
          {count > 1 && (
            <button
              type="button"
              onClick={prev}
              aria-label="Previous attachment"
              className="text-2xl text-muted hover:text-text px-1"
            >
              ‹
            </button>
          )}

          <div className="flex-1 min-w-0 flex items-center justify-center min-h-40">
            {!url ? (
              <span className="text-muted text-sm">Loading…</span>
            ) : isImage ? (
              <img
                src={url}
                alt={current.originalName}
                data-testid="viewer-image"
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                📄 Open PDF — {current.originalName}
              </a>
            )}
          </div>

          {count > 1 && (
            <button
              type="button"
              onClick={next}
              aria-label="Next attachment"
              className="text-2xl text-muted hover:text-text px-1"
            >
              ›
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <span data-testid="viewer-position" className="text-muted text-xs">
            {index + 1} / {count}
          </span>
          {confirming ? (
            <button
              type="button"
              onClick={() => { setConfirming(false); onDelete(current); }}
              aria-label="Confirm delete attachment"
              className="text-xs bg-negative text-white rounded-md px-2.5 py-1"
            >
              Confirm delete
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete attachment"
              className="text-xs text-muted hover:text-negative"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
