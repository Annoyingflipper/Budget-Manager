import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';
import { NAV_ITEMS, type Page } from '../navigation';
import Wordmark from './Wordmark';

type Props = {
  page: Page;
  onNavigate: (page: Page) => void;
};

/**
 * Desktop navigation. The mobile equivalent is TabBarNav; both render
 * NAV_ITEMS so they cannot drift apart.
 *
 * Icons are decorative and always paired with their label — the accessible
 * name is the label alone, so a screen reader never reads an emoji as the
 * destination.
 */
export default function SidebarNav({ page, onNavigate }: Props) {
  const { mode, setMode } = useTheme();

  return (
    <nav
      aria-label="Main"
      // sticky + h-[calc(100vh-2rem)]: pins the nav to the viewport instead of
      // letting it stretch to the height of its sibling (see AppShell's
      // items-start comment). top-4 and the 2rem subtracted here both mirror
      // AppShell's p-4 (1rem top/bottom padding around this flex row) — change
      // one and you must change the other, or the nav either overshoots the
      // viewport by 1rem or leaves a 1rem gap at the bottom. overflow-y-auto
      // is a backstop so a future nav-items addition scrolls internally
      // instead of reintroducing this bug.
      className="sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto flex flex-col gap-1 w-56 shrink-0 p-4 bg-card rounded-card shadow-e1"
    >
      <div className="mb-4 px-2">
        <Wordmark />
      </div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.page}
          type="button"
          onClick={() => onNavigate(item.page)}
          aria-current={page === item.page ? 'page' : undefined}
          className={`flex items-center gap-2 text-label rounded-control px-3 py-2 text-left border-0 ${
            page === item.page ? 'bg-highlight text-text' : 'bg-transparent text-muted'
          }`}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div className="mt-auto pt-4 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
          aria-label="Toggle color mode"
          className="flex items-center gap-2 text-label rounded-control px-3 py-2 text-left border-0 bg-transparent text-muted"
        >
          <span aria-hidden="true">{mode === 'light' ? '🌙' : '☀️'}</span>
          {mode === 'light' ? 'Dark' : 'Light'}
        </button>
        <button
          type="button"
          onClick={() => { supabase.auth.signOut(); }}
          className="text-label rounded-control px-3 py-2 text-left border-0 bg-transparent text-muted"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
