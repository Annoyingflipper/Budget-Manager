import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

type Props = {
  onCommit: (item: { name: string; projected: number; actual: number }) => void;
  onDiscard: () => void;
};

export default function DraftRow({ onCommit, onDiscard }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [projected, setProjected] = useState('0');
  const [actual, setActual] = useState('0');
  const [resolved, setResolved] = useState(false);

  function finalize(action: 'commit' | 'discard') {
    if (resolved) return;
    setResolved(true);
    if (action === 'commit') {
      const trimmed = name.trim();
      if (!trimmed) { onDiscard(); return; }
      onCommit({
        name: trimmed,
        projected: Number(projected) || 0,
        actual: Number(actual) || 0,
      });
    } else {
      onDiscard();
    }
  }

  function handleFocusOut(e: FocusEvent<HTMLDivElement>) {
    if (rowRef.current?.contains(e.relatedTarget as Node)) return;
    finalize('commit');
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); finalize('commit'); }
    if (e.key === 'Escape') { e.preventDefault(); finalize('discard'); }
  }

  return (
    <div
      ref={rowRef}
      onBlur={handleFocusOut}
      className="grid items-center gap-1.5"
      style={{ gridTemplateColumns: '1.4fr 80px 80px 80px 24px' }}
    >
      <input
        autoFocus
        type="text"
        placeholder="Item name"
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKey}
        className="px-2 py-1 border border-highlight rounded-md bg-card text-sm"
      />
      <input
        type="number"
        step="0.01"
        aria-label="Projected"
        value={projected}
        onChange={(e) => setProjected(e.target.value)}
        onKeyDown={handleKey}
        className="px-2 py-1 border border-highlight rounded-md bg-card text-sm text-right"
      />
      <input
        type="number"
        step="0.01"
        aria-label="Actual"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        onKeyDown={handleKey}
        className="px-2 py-1 border border-highlight rounded-md bg-card text-sm text-right"
      />
      <div />
      <div />
    </div>
  );
}
