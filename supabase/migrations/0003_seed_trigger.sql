-- When a new auth.users row is inserted (signup), automatically seed:
--   - one income row (projected=0, actual=0)
--   - eight default categories in fixed display order
--
-- security definer is required to write into public schema on behalf of
-- the auth schema's signup transaction.
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_user_budget();
