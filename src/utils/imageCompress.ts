const DEFAULT_MAX_EDGE = 1600;
const QUALITY = 0.8;

/**
 * Downscale and re-encode an image before upload.
 *
 * Supabase's free tier allows 1 GB. Raw phone photos run 3–5 MB, which is only
 * ~240 receipts; compressed they land near 200 KB, which is thousands. Receipts
 * stay perfectly legible at 1600px and upload far faster on mobile data.
 *
 * Every failure path returns the ORIGINAL file: losing compression is a much
 * better outcome than losing the receipt. HEIC is the common case — Safari
 * decodes it on a canvas, desktop Chrome does not.
 */
export async function compressImage(file: File, maxEdge = DEFAULT_MAX_EDGE): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= maxEdge) {
    bitmap.close?.();
    return file;
  }

  const scale = maxEdge / longest;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!blob) return file;

  const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
  return new File([blob], name, { type: 'image/jpeg' });
}
