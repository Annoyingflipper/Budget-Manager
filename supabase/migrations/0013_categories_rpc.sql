-- v1.5: atomic helpers for category delete (with item migration) and reorder.

create or replace function public.move_and_delete_category(src_id bigint, dst_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if (select auth.jwt() ->> 'aal') <> 'aal2' then raise exception 'mfa required'; end if;
  if not exists (select 1 from public.categories where id = src_id and user_id = uid)
     or not exists (select 1 from public.categories where id = dst_id and user_id = uid) then
    raise exception 'category not found';
  end if;
  if src_id = dst_id then raise exception 'src and dst must differ'; end if;
  if (select count(*) from public.categories where user_id = uid) < 2 then
    raise exception 'cannot delete the last category';
  end if;

  update public.line_items set category_id = dst_id
    where user_id = uid and category_id = src_id;
  delete from public.categories where id = src_id and user_id = uid;
end;
$$;

create or replace function public.reorder_categories(ordered_ids bigint[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if (select auth.jwt() ->> 'aal') <> 'aal2' then raise exception 'mfa required'; end if;
  if (select count(*) from public.categories where user_id = uid) <> array_length(ordered_ids, 1) then
    raise exception 'must reorder every category';
  end if;

  update public.categories c
     set display_order = i.idx
    from unnest(ordered_ids) with ordinality as i(id, idx)
   where c.id = i.id and c.user_id = uid;
end;
$$;

grant execute on function public.move_and_delete_category(bigint, bigint) to authenticated;
grant execute on function public.reorder_categories(bigint[]) to authenticated;
