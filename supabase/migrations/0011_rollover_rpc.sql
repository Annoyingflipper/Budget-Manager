-- v1.4: rollover_month copies one user's income + line_items from from_month
-- to to_month: same names, same projected values, actuals reset to 0. Raises
-- if any data already exists for to_month so partial rollovers can't mix with
-- typed-in data. security invoker so RLS still applies.
create or replace function public.rollover_month(from_month date, to_month date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if (select auth.jwt() ->> 'aal') <> 'aal2' then
    raise exception 'mfa required';
  end if;
  if from_month is null or to_month is null then
    raise exception 'from_month and to_month required';
  end if;
  if from_month <> date_trunc('month', from_month)::date
     or to_month <> date_trunc('month', to_month)::date then
    raise exception 'months must be the first of the month';
  end if;
  if exists (select 1 from public.income where user_id = uid and period_month = to_month)
     or exists (select 1 from public.line_items where user_id = uid and period_month = to_month) then
    raise exception 'month % already has data; cannot roll over into it', to_month;
  end if;

  insert into public.income (user_id, period_month, projected, actual)
  select uid, to_month, projected, 0
  from public.income
  where user_id = uid and period_month = from_month;

  insert into public.line_items (user_id, category_id, name, projected, actual, period_month)
  select uid, category_id, name, projected, 0, to_month
  from public.line_items
  where user_id = uid and period_month = from_month;
end;
$$;

grant execute on function public.rollover_month(date, date) to authenticated;
