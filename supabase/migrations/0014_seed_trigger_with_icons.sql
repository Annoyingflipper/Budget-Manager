-- v1.5: seed new users with categories that include their default emojis.
-- Builds on 0010 (no income insert) and 0012 (icon column).
create or replace function public.seed_user_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, display_order, icon) values
    (new.id, 'Services',               1, '🛠'),
    (new.id, 'Entertainment',          2, '🎬'),
    (new.id, 'Loans',                  3, '🏦'),
    (new.id, 'Taxes',                  4, '📋'),
    (new.id, 'Savings or Investments', 5, '💎'),
    (new.id, 'Monthly Payments',       6, '🧾'),
    (new.id, 'Personal Care',          7, '🧴'),
    (new.id, 'Other',                  8, '✨');

  insert into public.user_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.seed_user_budget() from public, anon, authenticated;
