import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';
import { formatMonthLabel, nextMonth } from '../utils/month';

type Props = {
  selectedMonth: string;
  latestMonth: string | null;
  onPrev: () => void;
  onNext: () => void;
  onRollover: () => void;
  onOpenSettings: () => void;
  onOpenInsights: () => void;
};

export default function Header({
  selectedMonth,
  latestMonth,
  onPrev,
  onNext,
  onRollover,
  onOpenSettings,
  onOpenInsights,
}: Props) {
  const { mode, setMode } = useTheme();
  const showRollover = latestMonth === null || selectedMonth >= latestMonth;
  const nextLabel = formatMonthLabel(nextMonth(selectedMonth));

  return (
    <header className="flex flex-wrap justify-between items-center gap-2 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">💵</span>
        <span className="font-extrabold text-xl">Budget</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="bg-card border-0 rounded-lg px-2 py-1 text-sm font-bold"
        >
          ←
        </button>
        <span className="text-sm text-muted min-w-[7rem] text-center">
          {formatMonthLabel(selectedMonth)}
        </span>
        {showRollover ? (
          <button
            type="button"
            onClick={onRollover}
            className="bg-card border-0 rounded-lg px-2.5 py-1 text-xs font-bold"
          >
            Start {nextLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next month"
            className="bg-card border-0 rounded-lg px-2 py-1 text-sm font-bold"
          >
            →
          </button>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
          className="bg-card border-0 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          aria-label="Toggle color mode"
        >
          {mode === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <button
          type="button"
          onClick={onOpenInsights}
          className="bg-card border-0 rounded-lg px-2.5 py-1.5 text-xs font-bold"
        >
          📊 Insights
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="bg-card border-0 rounded-lg px-2.5 py-1.5 text-xs font-bold"
        >
          ⚙️ Settings
        </button>
        <button
          type="button"
          onClick={() => { supabase.auth.signOut(); }}
          className="bg-transparent border-0 px-2.5 py-1.5 text-xs text-muted"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
