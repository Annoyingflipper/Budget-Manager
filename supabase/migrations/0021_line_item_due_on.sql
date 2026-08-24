-- v2.0: when each line item is due. NULL = no due date.
-- Nullable, no default, no backfill — the same shape 0017 used for paid_on.
-- No date constraint: a bill belonging to August may legitimately be due in
-- early September. The existing line_items RLS select/update policies are
-- column-agnostic and already enforce AAL2, so this column inherits them.
alter table public.line_items add column due_on date;

-- Replaces the v1.4 rollover (0011). Two changes:
--
--   1. due_on carries forward on the same day-of-month, clamped to the length
--      of the target month, so a bill due the 31st becomes the 28th in February.
--   2. currency and rate_units_per_usd are copied. They were added in v1.9
--      (0019) but this insert has used a fixed column list since v1.4, so every
--      rollover since has silently reset foreign expenses to the base currency
--      and changed the month's totals with no visible error.
--
-- paid_on is still deliberately NOT copied: a rolled-over month starts unpaid.
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

  insert into public.line_items
    (user_id, category_id, name, projected, actual, period_month,
     currency, rate_units_per_usd, due_on)
  select uid, category_id, name, projected, 0, to_month,
         currency,
         rate_units_per_usd,
         case
           when due_on is null then null
           else to_month + least(
                  extract(day from due_on)::int,
                  extract(day from (to_month + interval '1 month' - interval '1 day'))::int
                ) - 1
         end
  from public.line_items
  where user_id = uid and period_month = from_month;
end;
$$;

grant execute on function public.rollover_month(date, date) to authenticated;
