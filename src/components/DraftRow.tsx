import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

type Props = {
  onCommit: (item: { name: string; projected: number; actual: number }) => void;
  onDiscard: () => void;
};

export default function DraftRow({ onCommit, onDiscard }: Props) {
  const isMobile = useIsMobile();
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

  const nameInput = (
    <input
      autoFocus
      type="text"
      placeholder="Item name"
      maxLength={80}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={handleKey}
      className="w-full min-w-0 px-2 py-1 border border-highlight rounded-md bg-card text-sm"
    />
  );

  const projectedInput = (
    <input
      type="number"
      step="0.01"
      aria-label="Projected"
      value={projected}
      onChange={(e) => setProjected(e.target.value)}
      onKeyDown={handleKey}
      className="w-full min-w-0 px-2 py-1 border border-highlight rounded-md bg-card text-sm text-right"
    />
  );

  const actualInput = (
    <input
      type="number"
      step="0.01"
      aria-label="Actual"
      value={actual}
      onChange={(e) => setActual(e.target.value)}
      onKeyDown={handleKey}
      className="w-full min-w-0 px-2 py-1 border border-highlight rounded-md bg-card text-sm text-right"
    />
  );

  if (isMobile) {
    return (
      <div
        ref={rowRef}
        onBlur={handleFocusOut}
        className="flex flex-col gap-2 p-2 bg-bg rounded-lg"
      >
        {nameInput}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Projected</div>
            {projectedInput}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Actual</div>
            {actualInput}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      onBlur={handleFocusOut}
      className="grid items-center gap-1.5"
      style={{ gridTemplateColumns: '1.4fr 80px 80px 80px 24px' }}
    >
      {nameInput}
      {projectedInput}
      {actualInput}
      <div />
      <div />
    </div>
  );
}
