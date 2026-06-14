-- v1.8: record when each line item was paid. NULL = unpaid.
-- Nullable, no default → all existing and new items start unpaid (no backfill).
-- No date constraint: a bill for one month may be paid in an adjacent month.
-- Existing line_items RLS select/update policies already cover all columns
-- (and enforce AAL2), so the new column inherits them — no policy change.
alter table public.line_items add column paid_on date;
