export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.5.1',
    date: '2026-05-30',
    title: 'Polish & changelog',
    highlights: [
      'Mobile drag-and-drop now works for reordering categories.',
      'Renaming, adding, deleting, and reordering categories no longer needs a page refresh.',
      'Delete confirmation is now one-at-a-time across line items.',
      "New \"What's new\" button in Settings; this popup auto-shows after each release.",
      'Anonymous performance + traffic metrics via Vercel Analytics.',
      'Updated logo emoji.',
    ],
  },
  {
    version: '1.5',
    date: '2026-05-30',
    title: 'Custom categories',
    highlights: [
      'Categories are now yours to edit from Settings → Categories.',
      'Rename, add, delete (with forced move of items), reorder via drag handle.',
      'Pick the emoji for each category from a curated grid or paste any emoji.',
    ],
  },
  {
    version: '1.4',
    date: '2026-05-30',
    title: 'Month rollover & history',
    highlights: [
      'Each calendar month is now its own budget snapshot.',
      'Use ← / → in the header to navigate; past months stay editable.',
      'New "Start <next month>" button copies projected values forward.',
    ],
  },
  {
    version: '1.3',
    date: '2026-05-27',
    title: 'Auth polish',
    highlights: [
      'Authenticator-app labels now read by Vercel URL instead of "localhost:3000".',
      'Documented session persistence and deferred items.',
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
