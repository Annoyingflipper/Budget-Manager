# Receipt attachments — design

**Date:** 2026-08-01
**Status:** Approved, ready for planning
**Ships as:** part of `v1.9` (chunk 3 of 3; see the accounts spec for the rollout plan)

## Problem

When money is spent there is no way to keep proof of it against the expense. Receipts and
payment screenshots live in a phone camera roll, disconnected from the budget line they belong
to, so verifying a past expense means hunting through photos by date.

## Goals

Attach one or more images or PDFs to any expense, view them without leaving the budget page, and
keep them private.

## Non-goals

- **No OCR, no auto-fill.** Attaching a receipt does not read the amount off it.
- **No gallery page.** Attachments are reached through the expense they belong to. A
  browse-all-receipts view was considered and deferred — it is a whole extra page and can follow
  later if hunting for a receipt ever proves hard.
- **No attachments on income or on accounts.** Expenses only.
- **No editing** of images in the app (crop, rotate, annotate).

## Schema — `supabase/migrations/0019_line_item_attachments.sql`

```sql
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
```

RLS enabled, with a policy in the current wrapped form from `0007_rls_perf.sql`:
`(select auth.uid()) = user_id and ((select auth.jwt()) ->> 'aal') = 'aal2'`.

## Storage

A **private** bucket named `receipts`. Paths are `{user_id}/{line_item_id}/{uuid}.{ext}`, so the
first path segment is the owner and storage policies can key off it:

```sql
-- read/insert/delete restricted to the owner's own folder, AAL2 required
(storage.foldername(name))[1] = (select auth.uid())::text
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
```

Private rather than public is a deliberate choice: receipts routinely show bank details, card
digits and addresses, and a public bucket serves them from a guessable URL to anyone. Images are
therefore fetched through **short-lived signed URLs** (60s TTL) generated on demand, and signed
URLs are never persisted.

## Orphaned files — the thing that needs explicit handling

The foreign key cascade removes attachment **rows** when an expense is deleted, but it does
**not** remove the underlying objects from Storage. Left unhandled, every deleted expense
silently leaks its files and they count against the quota forever with nothing in the database
pointing at them.

Three call sites must delete storage objects *before* removing the owning rows:

1. `deleteLineItem` — remove that expense's objects.
2. `delete_month` (the v1.7 RPC) — the client wrapper must list and remove objects for every
   expense in the month before calling the RPC, since Postgres cannot reach Storage.
3. `moveAndDeleteCategory` — expenses move rather than disappear, so attachments follow them and
   nothing is deleted. Verified by test rather than assumed.

Each gets an explicit test asserting that no objects remain for the deleted expense.

## Upload

Selected file → validate → compress if it is an image → upload to Storage → insert the row.

**Compression.** Images are downscaled so the longest edge is ≤1600px and re-encoded as JPEG at
quality 0.8, on a canvas, in the browser. Supabase's free tier allows 1 GB; raw phone photos run
3–5 MB, which is roughly 240 receipts, while compressed ones land near 200 KB, which is
thousands. Receipts stay legible at that size and uploads get far faster on mobile data.

**HEIC.** Safari decodes HEIC on a canvas; desktop Chrome does not. If canvas decode fails for
any reason the **original file is uploaded untouched** rather than the upload failing. Losing
compression is a much better outcome than losing the receipt.

**PDFs** are never re-encoded. They upload as-is and display as a document icon.

**The file input deliberately omits the `capture` attribute.** Including it forces the camera
and skips the library on mobile; omitting it lets the phone offer both, which matters when the
proof is a screenshot already sitting in the camera roll.

**Guards.** 10 MB per file before compression, 8 attachments per expense, and a mime allowlist
of `image/*` plus `application/pdf`. Each rejection surfaces a specific inline message, not a
generic failure.

## Viewing

`AttachmentStrip` renders in the expense row: a thumbnail for a single image, or 📎 with a count
when there are several, and a `＋` affordance when there are none. Thumbnails load lazily — a
month of expenses should not trigger dozens of signed-URL requests on first paint.

Clicking opens `AttachmentViewer`, a fullscreen modal showing the image with the expense's name,
amount and date, and `‹ ›` navigation across that expense's attachments. It needs
`role="dialog"`, `aria-modal`, a focus trap, Esc to close, and focus returned to the trigger on
close. PDFs open in a new tab via their signed URL rather than rendering inline.

## Code layout

**New:** `src/api/attachments.ts` (list, upload, delete, signed URLs),
`src/utils/imageCompress.ts` (pure enough to unit test against a mocked canvas),
`src/components/AttachmentStrip.tsx`, `src/components/AttachmentViewer.tsx`.

**Modified:** `src/types.ts` (`Attachment`), `src/components/LineItemRow.tsx` (mount the strip),
`src/api/budget.ts` (`deleteLineItem` and the `deleteMonth` wrapper clean up Storage),
`src/changelog.ts`, `CLAUDE.md`.

## Error handling

| Condition | Behaviour |
|---|---|
| File over 10 MB | Rejected before upload with the actual size named. |
| Disallowed mime type | Rejected with the accepted types named. |
| Canvas/HEIC decode failure | Fall back to uploading the original. Not an error. |
| Upload fails mid-way | No row is inserted; inline retry offered. No half-attached state. |
| Row insert fails after upload | Uploaded object is removed, so no orphan is created. |
| Signed URL generation fails | Placeholder in place of the thumbnail; retry on click. |
| Attachment limit reached | `＋` disabled with the limit explained. |

Upload-then-insert is ordered so that the only possible inconsistency is an object with no row,
and that case is cleaned up immediately. The reverse order would leave rows pointing at files
that do not exist, which is the harder failure to detect later.

## Testing

**Vitest.** `imageCompress.test.ts` (downscales past the threshold, leaves small images alone,
falls back to the original on decode failure, never re-encodes PDFs), `attachments` API mapping
and the signed-URL path, `AttachmentStrip` (none / one / several, limit reached),
`AttachmentViewer` (navigation, Esc, focus trap, focus restoration), and the deletion-cleanup
tests for `deleteLineItem` and `deleteMonth` described above. Storage calls are mocked.

**Playwright.** `e2e/specs/receipts.e2e.ts` — upload a fixture image to an expense, assert the
thumbnail appears, open the viewer, upload a second file and assert navigation between them,
delete one, then delete the expense and assert the attachment rows are gone.

An **axe scan of the open viewer** is included. The existing accessibility coverage is
Settings-only, and a fullscreen modal with keyboard navigation is exactly the kind of surface
that regresses silently.

**`e2e/support/seed.ts` must purge the test user's `receipts` bucket folder** as well as the
`line_item_attachments` rows. The suite shares one QA user, so uploads would otherwise
accumulate across every CI run — filling the quota and breaking count assertions.

## Open risks

- **Storage quota is finite.** 1 GB with compression is thousands of receipts, which is ample,
  but there is no quota monitoring in this design. If it ever matters, a usage figure in
  Settings is the natural follow-up.
- **HEIC on desktop Chrome uploads uncompressed**, so a few large files may land in the bucket.
  Acceptable; the alternative is rejecting the file.
- **`byte_size` and `mime_type` are recorded from the client** and are advisory. The storage
  policies, not these columns, are what actually enforce access.
