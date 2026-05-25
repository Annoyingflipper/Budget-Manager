-- Wrap auth.uid() and auth.jwt() in (select ...) so Postgres evaluates them
-- once per query instead of once per row. Same predicate semantics as before.

-- income
drop policy "own income, mfa required" on public.income;
create policy "own income, mfa required" on public.income
  for all
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

-- categories
drop policy "own categories, mfa required" on public.categories;
create policy "own categories, mfa required" on public.categories
  for all
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

-- line_items
drop policy "own line_items, mfa required" on public.line_items;
create policy "own line_items, mfa required" on public.line_items
  for all
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

-- user_preferences
drop policy "own preferences, mfa required" on public.user_preferences;
create policy "own preferences, mfa required" on public.user_preferences
  for all
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );
