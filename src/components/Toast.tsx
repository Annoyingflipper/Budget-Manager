import { useEffect, useState } from 'react';

type Props = {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
  timeoutMs?: number;
};

export default function Toast({ message, type, onDismiss, timeoutMs = 3000 }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enterId = setTimeout(() => setVisible(true), 10);
    const exitId = setTimeout(onDismiss, timeoutMs);
    return () => { clearTimeout(enterId); clearTimeout(exitId); };
  }, [onDismiss, timeoutMs]);

  const bg = type === 'success' ? 'bg-positive' : 'bg-negative';
  const icon = type === 'success' ? '✓' : '!';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 ${bg} text-white text-sm font-bold pl-3 pr-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 min-w-[200px] max-w-xs ring-1 ring-white/20 transition-all duration-200 ease-out ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{message}</span>
    </div>
  );
}
