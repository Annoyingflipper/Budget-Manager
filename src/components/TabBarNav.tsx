import { NAV_ITEMS, type Page } from '../navigation';

type Props = {
  page: Page;
  onNavigate: (page: Page) => void;
};

/**
 * Mobile navigation — a fixed bottom bar, the desktop sidebar's counterpart.
 * Same props as SidebarNav so AppShell can swap between them directly.
 *
 * Four destinations and nothing else: colour mode and sign out live in
 * Settings, which is where a phone user reaches them.
 */
export default function TabBarNav({ page, onNavigate }: Props) {
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 flex bg-card shadow-e3 border-t border-highlight"
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.page}
          type="button"
          onClick={() => onNavigate(item.page)}
          aria-current={page === item.page ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center gap-1 py-2 text-caption border-0 bg-transparent ${
            page === item.page ? 'text-text' : 'text-muted'
          }`}
        >
          <span aria-hidden="true" className="text-heading">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
