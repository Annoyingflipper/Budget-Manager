-- One income row per user.
create table public.income (
  user_id    uuid primary key references auth.users on delete cascade,
  projected  numeric(12,2) not null default 0,
  actual     numeric(12,2) not null default 0,
  updated_at timestamptz   not null default now()
);

-- Eight categories per user, seeded automatically on signup (see 0003).
create table public.categories (
  id            bigint generated always as identity primary key,
  user_id       uuid          not null references auth.users on delete cascade,
  name          text          not null,
  display_order int           not null,
  unique (user_id, name)
);

create table public.line_items (
  id          bigint generated always as identity primary key,
  user_id     uuid           not null references auth.users on delete cascade,
  category_id bigint         not null references public.categories on delete cascade,
  name        text           not null,
  projected   numeric(12,2)  not null default 0,
  actual      numeric(12,2)  not null default 0,
  created_at  timestamptz    not null default now()
);

create index line_items_category_id_idx on public.line_items (category_id);
create index line_items_user_id_idx     on public.line_items (user_id);
create index categories_user_id_idx     on public.categories (user_id);
