-- v1.9 chunk 3: receipt / payment-screenshot attachments on expenses.

create table public.line_item_attachments (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  line_item_id  bigint not null references public.line_items on delete cascade,
  storage_path  text not null unique,
  mime_type     text not null,
  byte_size     int not null,
  original_name text not null,
  created_at    timestamptz not null default now()
);

create index line_item_attachments_line_item_id_idx
  on public.line_item_attachments (line_item_id);

alter table public.line_item_attachments enable row level security;

create policy "own attachments, mfa required" on public.line_item_attachments
  for all
  using (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

-- Private bucket: receipts routinely show bank details and card digits, so they
-- must never be served from a guessable public URL. Access is via signed URLs.
--
-- NOTE: the FK cascade above removes attachment ROWS when an expense is deleted,
-- but Postgres cannot reach Storage — the objects must be removed by the client
-- before the rows that name them (see src/api/attachments.ts).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Paths are {user_id}/{line_item_id}/{uuid}.{ext}, so the first path segment is
-- the owner and the same AAL2 rule as every other table applies.
create policy "own receipt objects, mfa required" on storage.objects
  for all
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );
