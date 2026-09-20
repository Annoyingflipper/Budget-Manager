/**
 * The app's four destinations, in the order both navigations render them.
 *
 * SidebarNav (desktop) and TabBarNav (mobile) are two presentations of this
 * one list. Keeping it here is what stops them drifting apart — a destination
 * added to one and forgotten in the other is invisible on the platform it was
 * missed on, and nothing else would catch it.
 */

export type Page = 'budget' | 'settings' | 'insights' | 'accounts';

export type NavItem = {
  page: Page;
  /** Visible text, and the accessible name in both navigations. */
  label: string;
  /** Decorative — always paired with the label, never the sole indicator. */
  icon: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { page: 'budget', label: 'Budget', icon: '💵' },
  { page: 'accounts', label: 'Accounts', icon: '🏦' },
  { page: 'insights', label: 'Insights', icon: '📊' },
  { page: 'settings', label: 'Settings', icon: '⚙️' },
] as const;
