import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';

type Props = {
  monthLabel: string;
  onOpenSettings: () => void;
};

export default function Header({ monthLabel, onOpenSettings }: Props) {
  const { mode, setMode } = useTheme();
  return (
    <header className="flex justify-between items-center mb-4">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl">🍑</span>
        <span className="font-extrabold text-xl">Budget</span>
        <span className="text-muted text-sm">{monthLabel}</span>
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
