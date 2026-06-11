-- v1.7: delete_month removes one user's income + line_items for a single month.
-- Guarded so only months strictly after the current calendar month can be
-- deleted (accidental rollovers); current and past months are protected.
-- security invoker so RLS still applies — the function only ever touches the
-- caller's own rows.
create or replace function public.delete_month(target_month date)
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
  if target_month is null then
    raise exception 'target_month required';
  end if;
  if target_month <> date_trunc('month', target_month)::date then
    raise exception 'month must be the first of the month';
  end if;
  if target_month <= date_trunc('month', current_date)::date then
    raise exception 'cannot delete current or past months';
  end if;

  delete from public.line_items where user_id = uid and period_month = target_month;
  delete from public.income     where user_id = uid and period_month = target_month;
end;
$$;

grant execute on function public.delete_month(date) to authenticated;
