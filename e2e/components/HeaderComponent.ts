import type { Page, Locator } from '@playwright/test';

// The top `<header>` this component originally wrapped was removed when
// AppShell replaced it with a sidebar (desktop) / tab bar (mobile) — see
// src/components/Toolbar.tsx and src/components/SidebarNav.tsx. This
// component's PUBLIC API (every getter and method below) is deliberately
// frozen: 8 spec files across 22 call sites depend on these exact names and
// return types. Only what they point at has changed. Do not rename or
// remove any of them — repoint their internals instead.
export class HeaderComponent {
  // Month controls (prev/next/rollover/delete/label) live in Toolbar, whose
  // root carries data-testid="month-toolbar".
  private readonly monthToolbar: Locator;
  // Navigation, the mode toggle, and sign out live in SidebarNav (desktop)
  // — scoped by the shared aria-label="Main" landmark. Settings.tsx also
  // renders its own "Log out" button for mobile users, so this scope is
  // load-bearing: an unscoped locator would be a strict-mode violation the
  // moment a spec touches sign-out with Settings open. On desktop with
  // Settings open there are two buttons named "Log out" on screen at once
  // — the sidebar's and Settings.tsx's own — so any future sign-out
  // locator must be nav-scoped (or otherwise disambiguated) or it is an
  // instant Playwright strict-mode violation.
  private readonly nav: Locator;

  constructor(page: Page) {
    this.monthToolbar = page.getByTestId('month-toolbar');
    this.nav = page.getByRole('navigation', { name: 'Main' });
  }
  get prevMonth(): Locator { return this.monthToolbar.getByRole('button', { name: 'Previous month' }); }
  get nextMonth(): Locator { return this.monthToolbar.getByRole('button', { name: 'Next month' }); }
  get startNextMonth(): Locator { return this.monthToolbar.getByRole('button', { name: /^Start / }); }
  get deleteMonthButton(): Locator { return this.monthToolbar.getByRole('button', { name: 'Delete this month' }); }
  get monthLabel(): Locator { return this.monthToolbar.getByText(/^[A-Z][a-z]+ \d{4}$/); }
  get modeToggle(): Locator { return this.nav.getByRole('button', { name: 'Toggle color mode' }); }
  get insightsButton(): Locator { return this.nav.getByRole('button', { name: /Insights/ }); }
  get settingsButton(): Locator { return this.nav.getByRole('button', { name: /Settings/ }); }
  get logoutButton(): Locator { return this.nav.getByRole('button', { name: 'Log out' }); }

  async goPrev(): Promise<void> { await this.prevMonth.click(); }
  async openInsights(): Promise<void> { await this.insightsButton.click(); }
  async openSettings(): Promise<void> { await this.settingsButton.click(); }
  async toggleMode(): Promise<void> { await this.modeToggle.click(); }
}
