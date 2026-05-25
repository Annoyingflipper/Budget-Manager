import ThemeCard from '../components/ThemeCard';
import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/types';

type Props = { onBack: () => void };

const THEMES: Theme[] = ['peach', 'sage', 'lavender'];

export default function Settings({ onBack }: Props) {
  const { theme, mode, setTheme, setMode } = useTheme();

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-muted text-sm hover:text-text"
        >
          ← Back to budget
        </button>
      </header>

      <div>
        <h1 className="text-3xl font-extrabold">Appearance</h1>
        <p className="text-muted text-sm">Make Budget feel like yours.</p>
      </div>

      {/* Color mode toggle */}
      <section className="bg-card rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-extrabold text-sm">Color mode</div>
            <div className="text-muted text-xs">Light during the day, dark at night.</div>
          </div>
          <div
            role="radiogroup"
            aria-label="Color mode"
            className="flex bg-bg rounded-xl p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'light'}
              onClick={() => setMode('light')}
              className={`px-3 py-1 text-xs font-bold rounded-lg ${
                mode === 'light' ? 'bg-card shadow-sm' : 'text-muted'
              }`}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'dark'}
              onClick={() => setMode('dark')}
              className={`px-3 py-1 text-xs font-bold rounded-lg ${
                mode === 'dark' ? 'bg-card shadow-sm' : 'text-muted'
              }`}
            >
              🌙 Dark
            </button>
          </div>
        </div>
      </section>

      {/* Theme picker */}
      <div className="font-extrabold text-sm">Theme</div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {THEMES.map((t) => (
          <ThemeCard
            key={t}
            theme={t}
            selected={theme === t}
            onSelect={() => setTheme(t)}
          />
        ))}
      </div>
    </div>
  );
}
