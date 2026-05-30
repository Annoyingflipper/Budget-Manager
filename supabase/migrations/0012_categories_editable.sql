-- v1.5: per-category emoji + delete-safety FK flip.
alter table public.categories add column icon text not null default '📁';

update public.categories set icon = '🛠'  where name = 'Services';
update public.categories set icon = '🎬'  where name = 'Entertainment';
update public.categories set icon = '🏦'  where name = 'Loans';
update public.categories set icon = '📋'  where name = 'Taxes';
update public.categories set icon = '💎'  where name = 'Savings or Investments';
update public.categories set icon = '🧾'  where name = 'Monthly Payments';
update public.categories set icon = '🧴'  where name = 'Personal Care';
update public.categories set icon = '✨'  where name = 'Other';

alter table public.line_items drop constraint line_items_category_id_fkey;
alter table public.line_items
  add constraint line_items_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete restrict;
