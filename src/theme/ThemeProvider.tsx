import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getPreferences, updatePreferences } from '../api/preferences';
import { DEFAULT_PREFERENCES } from './types';
import type { Mode, Preferences, Theme } from './types';

type ThemeContextValue = Preferences & {
  setTheme: (next: Theme) => void;
  setMode: (next: Mode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

function applyToHtml(prefs: Preferences) {
  document.documentElement.setAttribute('data-theme', prefs.theme);
  document.documentElement.setAttribute('data-mode', prefs.mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let cancelled = false;
    getPreferences()
      .then((loaded) => {
        if (cancelled) return;
        setPrefs(loaded);
        applyToHtml(loaded);
      })
      .catch(() => {
        // Stay on defaults if load fails (e.g., unauthenticated screens).
      });
    return () => { cancelled = true; };
  }, []);

  async function persist(next: Preferences, previous: Preferences) {
    setPrefs(next);
    applyToHtml(next);
    try {
      await updatePreferences(
        next.theme !== previous.theme ? { theme: next.theme }
          : next.mode !== previous.mode ? { mode: next.mode }
          : {}
      );
    } catch {
      setPrefs(previous);
      applyToHtml(previous);
    }
  }

  function setTheme(theme: Theme) {
    if (theme === prefs.theme) return;
    persist({ ...prefs, theme }, prefs);
  }

  function setMode(mode: Mode) {
    if (mode === prefs.mode) return;
    persist({ ...prefs, mode }, prefs);
  }

  return (
    <ThemeContext.Provider value={{ ...prefs, setTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
