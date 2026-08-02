import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageCompress';
import type { Attachment } from '../types';

const BUCKET = 'receipts';
const COLUMNS = 'id, line_item_id, storage_path, mime_type, byte_size, original_name';
const SIGNED_URL_TTL_SECONDS = 60;

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PER_ITEM = 8;

function isAllowed(type: string): boolean {
  return type.startsWith('image/') || type === 'application/pdf';
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

function normalize(raw: Record<string, unknown>): Attachment {
  return {
    id: raw.id as number,
    lineItemId: raw.line_item_id as number,
    storagePath: raw.storage_path as string,
    mimeType: raw.mime_type as string,
    byteSize: Number(raw.byte_size),
    originalName: raw.original_name as string,
  };
}

export async function listAttachments(lineItemIds: number[]): Promise<Attachment[]> {
  if (lineItemIds.length === 0) return [];
  const { data, error } = await supabase
    .from('line_item_attachments')
    .select(COLUMNS)
    .in('line_item_id', lineItemIds);
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

/** Short-lived by design; never persist the result. */
export async function signedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadAttachment(lineItemId: number, input: File): Promise<Attachment> {
  if (!isAllowed(input.type)) {
    throw new Error('Only images and PDFs can be attached.');
  }
  if (input.size > MAX_BYTES) {
    throw new Error(
      `That file is ${(input.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`,
    );
  }

  const existing = await listAttachments([lineItemId]);
  if (existing.length >= MAX_PER_ITEM) {
    throw new Error(`An expense can hold at most ${MAX_PER_ITEM} attachments.`);
  }

  const userId = await currentUserId();
  const file = await compressImage(input);
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const path = `${userId}/${lineItemId}/${crypto.randomUUID()}.${extension}`;

  // Object first. The only inconsistency this can leave is a stray object, which
  // is cleaned up immediately below; the reverse order would leave a row
  // pointing at a file that does not exist, which is far harder to detect.
  const { error: uploadErr } = await supabase
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from('line_item_attachments')
    .insert({
      user_id: userId,
      line_item_id: lineItemId,
      storage_path: path,
      mime_type: file.type,
      byte_size: file.size,
      original_name: input.name,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // Do not leave an orphan behind.
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  return normalize(data as Record<string, unknown>);
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  const { error: storageErr } = await supabase
    .storage.from(BUCKET)
    .remove([attachment.storagePath]);
  // Throw before touching the row: the row is what tells us this file exists.
  if (storageErr) throw storageErr;

  const { error } = await supabase
    .from('line_item_attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw error;
}

/**
 * Removes every attachment belonging to the given expenses.
 *
 * The FK cascade deletes attachment ROWS when an expense goes, but Postgres
 * cannot reach Storage — so the objects must be removed here, and crucially
 * BEFORE the rows, because those rows are the only record of which files exist.
 * If the storage call fails we throw and leave everything intact so it can be
 * retried; deleting the rows first would strand the files permanently.
 */
export async function removeAttachmentsForItems(lineItemIds: number[]): Promise<void> {
  if (lineItemIds.length === 0) return;

  const { data: rows, error } = await supabase
    .from('line_item_attachments')
    .select('storage_path')
    .in('line_item_id', lineItemIds);
  if (error) throw error;
  if (!rows || rows.length === 0) return;

  const paths = (rows as Array<Record<string, unknown>>).map((r) => r.storage_path as string);

  const { error: storageErr } = await supabase.storage.from(BUCKET).remove(paths);
  if (storageErr) throw storageErr;

  const { error: rowErr } = await supabase
    .from('line_item_attachments')
    .delete()
    .in('line_item_id', lineItemIds);
  if (rowErr) throw rowErr;
}
