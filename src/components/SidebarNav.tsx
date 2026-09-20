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
      className="flex flex-col gap-1 w-56 shrink-0 p-4 bg-card rounded-card shadow-e1"
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
