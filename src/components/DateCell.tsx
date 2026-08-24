import { useEffect, useState } from 'react';

type Props = {
  value: string | null;
  onSave: (next: string | null) => void;
  label: string;
  empty: { label: string; ariaLabel: string; onClick?: () => void };
  clear: { ariaLabel: string; glyph: string };
  tone?: 'overdue';
  testId?: string;
};

/**
 * The shared date control behind both Paid and Due.
 *
 * `editing` exists because Due has no value to render an input for until the
 * user asks for one — without it, clicking "＋ due" would have nothing to type
 * into. Paid never sets it: its empty button stamps today directly.
 */
export default function DateCell({ value, onSave, label, empty, clear, tone, testId }: Props) {
  const [draft, setDraft] = useState(value ?? '');
  const [editing, setEditing] = useState(false);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (value !== null) setEditing(false); }, [value]);

  if (value === null && !editing) {
    return (
      <button
        type="button"
        onClick={() => { if (empty.onClick) empty.onClick(); else setEditing(true); }}
        aria-label={empty.ariaLabel}
        data-testid={testId}
        className="w-full px-2 py-1 border border-highlight rounded-md bg-bg text-muted text-xs hover:text-positive"
      >
        {empty.label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-0" data-testid={testId}>
      <button
        type="button"
        onClick={() => { setEditing(false); onSave(null); }}
        aria-label={clear.ariaLabel}
        title={clear.ariaLabel}
        className="shrink-0 text-positive hover:text-negative text-sm"
      >
        {clear.glyph}
      </button>
      <input
        type="date"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (!draft) setEditing(false); onSave(draft || null); }}
        className={`w-full min-w-0 px-1 py-1 border rounded-md bg-card text-xs ${
          tone === 'overdue' ? 'border-negative ring-1 ring-negative' : 'border-highlight'
        }`}
      />
    </div>
  );
}
