-- v1.5.1: track which changelog version a user has dismissed.
-- null = never dismissed (first-time popup triggers).
alter table public.user_preferences
  add column last_seen_changelog_version text;
