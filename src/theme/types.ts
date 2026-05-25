export type Theme = 'peach' | 'sage' | 'lavender';
export type Mode = 'light' | 'dark';

export type Preferences = {
  theme: Theme;
  mode: Mode;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'peach',
  mode: 'light',
};
