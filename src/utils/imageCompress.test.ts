import { describe, it, expect, vi, afterEach } from 'vitest';
import { compressImage } from './imageCompress';

function makeFile(name: string, type: string, size = 1000): File {
  return new File(['x'.repeat(size)], name, { type });
}

function stubCanvas(blob: Blob | null = new Blob(['small'], { type: 'image/jpeg' })) {
  const ctx = { drawImage: vi.fn() };
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return realCreate(tag);
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => cb(blob),
    } as unknown as HTMLCanvasElement;
  }) as typeof document.createElement);
  return ctx;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('compressImage', () => {
  it('returns PDFs untouched', async () => {
    const pdf = makeFile('invoice.pdf', 'application/pdf');
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it('returns non-image types untouched', async () => {
    const other = makeFile('notes.txt', 'text/plain');
    expect(await compressImage(other)).toBe(other);
  });

  // Losing compression is far better than losing the receipt. HEIC decodes on
  // Safari but not on desktop Chrome.
  it('falls back to the original when the image cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('unsupported')));
    const heic = makeFile('IMG_1234.HEIC', 'image/heic');
    expect(await compressImage(heic)).toBe(heic);
  });

  it('leaves an already-small image alone', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 800, height: 600, close() {} }));
    const small = makeFile('small.jpg', 'image/jpeg');
    expect(await compressImage(small, 1600)).toBe(small);
  });

  it('downscales a large image and re-encodes it as JPEG', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 4000, height: 3000, close() {} }));
    stubCanvas();
    const big = makeFile('big.jpg', 'image/jpeg', 5000);
    const out = await compressImage(big, 1600);
    expect(out).not.toBe(big);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('big.jpg');
  });

  it('renames a non-jpg source to .jpg once re-encoded', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 4000, height: 3000, close() {} }));
    stubCanvas();
    const png = makeFile('screenshot.png', 'image/png', 5000);
    const out = await compressImage(png, 1600);
    expect(out.name).toBe('screenshot.jpg');
  });

  it('scales the longest edge down to the limit, preserving aspect ratio', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 4000, height: 2000, close() {} }));
    const ctx = stubCanvas();
    await compressImage(makeFile('wide.jpg', 'image/jpeg', 5000), 1600);
    // 4000x2000 scaled by 1600/4000 = 1600x800
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
  });

  it('falls back to the original when the canvas produces nothing', async () => {
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 4000, height: 3000, close() {} }));
    stubCanvas(null);
    const big = makeFile('big.jpg', 'image/jpeg');
    expect(await compressImage(big, 1600)).toBe(big);
  });
});
