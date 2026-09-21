import { useEffect, useState } from 'react';
import ThemeCard from '../components/ThemeCard';
import CategoriesEditor from '../components/CategoriesEditor';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';
import { getBaseCurrency, setBaseCurrency } from '../api/userPrefs';
import { CURRENCIES, CURRENCY_CODES, type Currency } from '../utils/currency';
import type { Theme } from '../theme/types';

type Props = {
  onBack: () => void;
  onCategoriesChanged: (action: 'added' | 'renamed' | 'icon' | 'deleted' | 'reordered') => void;
  onOpenChangelog: () => void;
};

const THEMES: Theme[] = ['peach', 'sage', 'lavender'];

export default function Settings({ onBack, onCategoriesChanged, onOpenChangelog }: Props) {
  const { theme, mode, setTheme, setMode } = useTheme();
  const [baseCurrency, setBase] = useState<Currency>('USD');

  useEffect(() => {
    let cancelled = false;
    getBaseCurrency()
      .then((c) => { if (!cancelled) setBase(c); })
      .catch(() => { /* non-fatal: the USD default stands */ });
    return () => { cancelled = true; };
  }, []);

  async function handleBaseCurrency(next: Currency) {
    const previous = baseCurrency;
    setBase(next);
    try {
      await setBaseCurrency(next);
    } catch {
      setBase(previous); // don't leave the UI claiming a preference that didn't save
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-label text-muted hover:text-text"
        >
          ← Back to budget
        </button>
      </header>

      <div>
        <h1 className="text-title">Appearance</h1>
        <p className="text-muted text-body">Make Budget feel like yours.</p>
      </div>

      {/* Color mode toggle */}
      <section className="bg-card rounded-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-label">Color mode</div>
            <div className="text-muted text-caption">Light during the day, dark at night.</div>
          </div>
          <div
            role="radiogroup"
            aria-label="Color mode"
            className="flex bg-bg rounded-card p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'light'}
              onClick={() => setMode('light')}
              className={`px-3 py-1 text-label rounded-control ${
                mode === 'light' ? 'bg-card shadow-e1' : 'text-muted'
              }`}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'dark'}
              onClick={() => setMode('dark')}
              className={`px-3 py-1 text-label rounded-control ${
                mode === 'dark' ? 'bg-card shadow-e1' : 'text-muted'
              }`}
            >
              🌙 Dark
            </button>
          </div>
        </div>
      </section>

      {/* Theme picker */}
      <div className="text-label">Theme</div>
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

      <div>
        <h2 className="text-title">Categories</h2>
        <p className="text-muted text-body">Make the budget match what you actually spend on.</p>
      </div>
      <section className="bg-card rounded-card p-4">
        <div className="text-label">Base currency</div>
        <div className="text-muted text-caption mb-2">
          The currency your total available is shown in.
        </div>
        <select
          value={baseCurrency}
          onChange={(e) => handleBaseCurrency(e.target.value as Currency)}
          aria-label="Base currency"
          className="px-2 py-1 border border-highlight rounded-control bg-bg text-body"
        >
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>{CURRENCIES[code].label} ({code})</option>
          ))}
        </select>
      </section>

      <CategoriesEditor onCategoriesChanged={onCategoriesChanged} />

      <div className="pt-4">
        <button
          type="button"
          onClick={onOpenChangelog}
          className="bg-card border-0 rounded-control px-3 py-2 text-label"
        >
          🆕 What's new
        </button>
      </div>

      <section className="bg-card rounded-card p-4">
        <button
          type="button"
          onClick={() => { supabase.auth.signOut(); }}
          className="text-label rounded-control px-3 py-2 border-0 bg-card text-negative"
        >
          Log out
        </button>
      </section>
    </div>
  );
}
