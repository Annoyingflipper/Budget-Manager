-- Extend seed_user_budget() to also create the user_preferences row.
-- Same security definer + locked search_path as the v1 version.
create or replace function public.seed_user_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.income (user_id) values (new.id);

  insert into public.categories (user_id, name, display_order) values
    (new.id, 'Services',               1),
    (new.id, 'Entertainment',          2),
    (new.id, 'Loans',                  3),
    (new.id, 'Taxes',                  4),
    (new.id, 'Savings or Investments', 5),
    (new.id, 'Monthly Payments',       6),
    (new.id, 'Personal Care',          7),
    (new.id, 'Other',                  8);

  -- New in v1.1: seed default preferences. on conflict do nothing protects
  -- against re-running and races with the 0005 backfill.
  insert into public.user_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Lock down RPC surface (same pattern as 0004 for the v1 function).
revoke execute on function public.seed_user_budget() from public, anon, authenticated;
