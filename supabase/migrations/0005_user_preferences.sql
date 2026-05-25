create table public.user_preferences (
  user_id    uuid primary key references auth.users on delete cascade,
  theme      text not null default 'peach'
             check (theme in ('peach', 'sage', 'lavender')),
  color_mode text not null default 'light'
             check (color_mode in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "own preferences, mfa required" on public.user_preferences
  for all
  using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  );

-- Backfill: every existing auth.users row gets default preferences.
insert into public.user_preferences (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
