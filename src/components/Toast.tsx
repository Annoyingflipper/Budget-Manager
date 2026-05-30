import { useEffect } from 'react';

type Props = {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
  timeoutMs?: number;
};

export default function Toast({ message, type, onDismiss, timeoutMs = 2500 }: Props) {
  useEffect(() => {
    const id = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(id);
  }, [onDismiss, timeoutMs]);

  const bg = type === 'success' ? 'bg-positive/90' : 'bg-negative/90';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 ${bg} text-white text-sm font-bold px-4 py-2 rounded-lg shadow-lg z-50`}
    >
      {message}
    </div>
  );
}
