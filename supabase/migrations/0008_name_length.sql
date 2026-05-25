alter table public.line_items
  add constraint line_items_name_length check (char_length(name) <= 80);

alter table public.categories
  add constraint categories_name_length check (char_length(name) <= 80);
