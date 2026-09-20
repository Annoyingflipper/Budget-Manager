import type { ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import SidebarNav from './SidebarNav';
import TabBarNav from './TabBarNav';
import type { Page } from '../navigation';

type Props = {
  page: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
};

/**
 * The layout frame: picks a navigation and places the content beside or above
 * it. Owns nothing else — no routing, no data, no page state.
 *
 * Exactly one <nav> is rendered in either layout; two landmarks would make
 * "skip to navigation" ambiguous.
 */
export default function AppShell({ page, onNavigate, children }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen">
        {/* Bottom padding clears the fixed bar so the last row stays reachable. */}
        <main className="p-4 pb-24">{children}</main>
        <TabBarNav page={page} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex gap-4 p-4">
      <SidebarNav page={page} onNavigate={onNavigate} />
      <main className="flex-1 min-w-0 max-w-3xl">{children}</main>
    </div>
  );
}
