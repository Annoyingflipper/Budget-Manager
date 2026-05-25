alter table public.income     enable row level security;
alter table public.categories enable row level security;
alter table public.line_items enable row level security;

create policy "own income, mfa required" on public.income
  for all
  using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "own categories, mfa required" on public.categories
  for all
  using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "own line_items, mfa required" on public.line_items
  for all
  using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  );
