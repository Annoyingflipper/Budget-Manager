import { useEffect, useRef, useState } from 'react';

type Props = {
  onPick: (emoji: string) => void;
  onClose: () => void;
};

const GRID: string[] = [
  '🛠', '🎬', '🏦', '📋', '💎', '🧾',
  '🧴', '✨', '🍔', '🚗', '🏠', '🏥',
  '✈️', '🛒', '📱', '🎮', '📚', '👕',
  '💊', '🐕', '🎁', '⚽', '☕', '🎨',
  '💼', '🏋️', '🎓', '🎵', '🌱', '⛽',
];

export default function EmojiPicker({ onPick, onClose }: Props) {
  const [text, setText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  function submitFreeform() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onPick(trimmed);
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Pick an emoji"
      className="bg-card border border-highlight rounded-xl p-3 shadow-lg w-64"
    >
      <div className="grid grid-cols-6 gap-1 mb-2">
        {GRID.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            aria-label={emoji}
            className="text-lg hover:bg-bg rounded-md p-1"
          >
            {emoji}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submitFreeform(); }
        }}
        placeholder="Or paste any emoji"
        className="w-full px-2 py-1 border border-highlight rounded-md bg-bg text-sm"
      />
    </div>
  );
}
