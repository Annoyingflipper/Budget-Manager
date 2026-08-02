import { describe, it, expect, vi, beforeEach } from 'vitest';

type Call = { kind: string; args: unknown[] };
const calls: Call[] = [];

// --- table mock -------------------------------------------------------------
let selectResult: { data: unknown; error: unknown } = { data: [], error: null };
let insertResult: { data: unknown; error: unknown } = { data: null, error: null };
let deleteRowsResult: { error: unknown } = { error: null };

function tableMock() {
  const chain: Record<string, unknown> = {};
  chain.select = (...args: unknown[]) => {
    calls.push({ kind: 'select', args });
    return {
      in: (...a: unknown[]) => { calls.push({ kind: 'select.in', args: a }); return Promise.resolve(selectResult); },
      eq: (...a: unknown[]) => { calls.push({ kind: 'select.eq', args: a }); return Promise.resolve(selectResult); },
      single: () => Promise.resolve(insertResult),
    };
  };
  chain.insert = (...args: unknown[]) => {
    calls.push({ kind: 'insert', args });
    return { select: () => ({ single: () => Promise.resolve(insertResult) }) };
  };
  chain.delete = (...args: unknown[]) => {
    calls.push({ kind: 'delete', args });
    return {
      in: (...a: unknown[]) => { calls.push({ kind: 'delete.in', args: a }); return Promise.resolve(deleteRowsResult); },
      eq: (...a: unknown[]) => { calls.push({ kind: 'delete.eq', args: a }); return Promise.resolve(deleteRowsResult); },
    };
  };
  return chain;
}

// --- storage mock -----------------------------------------------------------
let uploadResult: { error: unknown } = { error: null };
let removeResult: { error: unknown } = { error: null };

const storageMock = {
  from: (bucket: string) => {
    calls.push({ kind: 'storage.from', args: [bucket] });
    return {
      upload: (...args: unknown[]) => { calls.push({ kind: 'upload', args }); return Promise.resolve(uploadResult); },
      remove: (...args: unknown[]) => { calls.push({ kind: 'remove', args }); return Promise.resolve(removeResult); },
      createSignedUrl: (...args: unknown[]) => {
        calls.push({ kind: 'createSignedUrl', args });
        return Promise.resolve({ data: { signedUrl: 'https://signed/x' }, error: null });
      },
    };
  },
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => { calls.push({ kind: 'from', args }); return tableMock(); },
    // Referenced lazily: vi.mock is hoisted above the const declarations, so the
    // factory must not read `storageMock` as a value at definition time.
    storage: { from: (bucket: string) => storageMock.from(bucket) },
  },
}));

vi.mock('../utils/imageCompress', () => ({
  compressImage: (f: File) => Promise.resolve(f),
}));

import {
  uploadAttachment, deleteAttachment, removeAttachmentsForItems,
  listAttachments, signedUrl, MAX_BYTES, MAX_PER_ITEM,
} from './attachments';

function file(name = 'r.jpg', type = 'image/jpeg', size = 100): File {
  return new File(['x'.repeat(size)], name, { type });
}

beforeEach(() => {
  calls.length = 0;
  selectResult = { data: [], error: null };
  insertResult = { data: null, error: null };
  deleteRowsResult = { error: null };
  uploadResult = { error: null };
  removeResult = { error: null };
});

describe('uploadAttachment guards', () => {
  it('rejects a file over the size limit before touching storage', async () => {
    const huge = new File([new Uint8Array(MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });
    await expect(uploadAttachment(7, huge)).rejects.toThrow(/too large|10 MB/i);
    expect(calls.some((c) => c.kind === 'upload')).toBe(false);
  });

  it('rejects a disallowed mime type', async () => {
    await expect(uploadAttachment(7, file('a.exe', 'application/x-msdownload')))
      .rejects.toThrow(/image|pdf/i);
    expect(calls.some((c) => c.kind === 'upload')).toBe(false);
  });

  it('accepts a PDF', async () => {
    insertResult = {
      data: {
        id: 1, line_item_id: 7, storage_path: 'user-1/7/x.pdf',
        mime_type: 'application/pdf', byte_size: 100, original_name: 'a.pdf',
      },
      error: null,
    };
    await expect(uploadAttachment(7, file('a.pdf', 'application/pdf'))).resolves.toBeTruthy();
  });

  it('rejects when the expense already has the maximum attachments', async () => {
    selectResult = { data: new Array(MAX_PER_ITEM).fill({ id: 1 }), error: null };
    await expect(uploadAttachment(7, file())).rejects.toThrow(new RegExp(String(MAX_PER_ITEM)));
    expect(calls.some((c) => c.kind === 'upload')).toBe(false);
  });
});

describe('uploadAttachment', () => {
  beforeEach(() => {
    insertResult = {
      data: {
        id: 1, line_item_id: 7, storage_path: 'user-1/7/x.jpg',
        mime_type: 'image/jpeg', byte_size: 100, original_name: 'r.jpg',
      },
      error: null,
    };
  });

  it('uploads under {user}/{item}/ then inserts the row', async () => {
    await uploadAttachment(7, file());
    const upload = calls.find((c) => c.kind === 'upload');
    expect(String(upload?.args[0])).toMatch(/^user-1\/7\//);
    const uploadIdx = calls.findIndex((c) => c.kind === 'upload');
    const insertIdx = calls.findIndex((c) => c.kind === 'insert');
    // object first, so the only possible inconsistency is a stray object
    expect(uploadIdx).toBeLessThan(insertIdx);
  });

  it('returns the attachment in camelCase', async () => {
    const a = await uploadAttachment(7, file());
    expect(a).toEqual({
      id: 1, lineItemId: 7, storagePath: 'user-1/7/x.jpg',
      mimeType: 'image/jpeg', byteSize: 100, originalName: 'r.jpg',
    });
  });

  // A row pointing at a missing file is the harder failure to detect later.
  it('removes the uploaded object when the row insert fails', async () => {
    insertResult = { data: null, error: { message: 'insert boom' } };
    await expect(uploadAttachment(7, file())).rejects.toBeTruthy();
    expect(calls.some((c) => c.kind === 'remove')).toBe(true);
  });

  it('does not insert a row when the upload fails', async () => {
    uploadResult = { error: { message: 'upload boom' } };
    await expect(uploadAttachment(7, file())).rejects.toBeTruthy();
    expect(calls.some((c) => c.kind === 'insert')).toBe(false);
  });
});

describe('deleteAttachment', () => {
  const attachment = {
    id: 1, lineItemId: 7, storagePath: 'user-1/7/x.jpg',
    mimeType: 'image/jpeg', byteSize: 100, originalName: 'r.jpg',
  };

  it('removes the object before the row', async () => {
    await deleteAttachment(attachment);
    const removeIdx = calls.findIndex((c) => c.kind === 'remove');
    const deleteIdx = calls.findIndex((c) => c.kind === 'delete');
    expect(removeIdx).toBeGreaterThanOrEqual(0);
    expect(removeIdx).toBeLessThan(deleteIdx);
  });

  it('leaves the row alone when the object removal fails', async () => {
    removeResult = { error: { message: 'storage down' } };
    await expect(deleteAttachment(attachment)).rejects.toBeTruthy();
    expect(calls.some((c) => c.kind === 'delete')).toBe(false);
  });
});

describe('removeAttachmentsForItems', () => {
  it('does nothing for an empty id list', async () => {
    await removeAttachmentsForItems([]);
    expect(calls).toHaveLength(0);
  });

  it('does nothing when the items have no attachments', async () => {
    selectResult = { data: [], error: null };
    await removeAttachmentsForItems([1, 2]);
    expect(calls.some((c) => c.kind === 'remove')).toBe(false);
    expect(calls.some((c) => c.kind === 'delete')).toBe(false);
  });

  it('reads the manifest, removes the objects, then deletes the rows', async () => {
    selectResult = {
      data: [{ storage_path: 'user-1/7/a.jpg' }, { storage_path: 'user-1/7/b.jpg' }],
      error: null,
    };
    await removeAttachmentsForItems([7]);

    const selectIdx = calls.findIndex((c) => c.kind === 'select');
    const removeIdx = calls.findIndex((c) => c.kind === 'remove');
    const deleteIdx = calls.findIndex((c) => c.kind === 'delete');
    expect(selectIdx).toBeLessThan(removeIdx);
    expect(removeIdx).toBeLessThan(deleteIdx);
    expect(calls.find((c) => c.kind === 'remove')?.args[0])
      .toEqual(['user-1/7/a.jpg', 'user-1/7/b.jpg']);
  });

  // The rows are the ONLY index of what to delete. Dropping them after a failed
  // storage removal would strand the files permanently.
  it('does not delete the rows when the storage removal fails', async () => {
    selectResult = { data: [{ storage_path: 'user-1/7/a.jpg' }], error: null };
    removeResult = { error: { message: 'storage down' } };
    await expect(removeAttachmentsForItems([7])).rejects.toBeTruthy();
    expect(calls.some((c) => c.kind === 'delete')).toBe(false);
  });
});

describe('listAttachments / signedUrl', () => {
  it('returns an empty list without querying for no ids', async () => {
    expect(await listAttachments([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('maps rows to camelCase', async () => {
    selectResult = {
      data: [{
        id: 3, line_item_id: 7, storage_path: 'user-1/7/a.jpg',
        mime_type: 'image/jpeg', byte_size: 10, original_name: 'a.jpg',
      }],
      error: null,
    };
    expect(await listAttachments([7])).toEqual([{
      id: 3, lineItemId: 7, storagePath: 'user-1/7/a.jpg',
      mimeType: 'image/jpeg', byteSize: 10, originalName: 'a.jpg',
    }]);
  });

  it('creates a short-lived signed url', async () => {
    expect(await signedUrl('user-1/7/a.jpg')).toBe('https://signed/x');
    const call = calls.find((c) => c.kind === 'createSignedUrl');
    expect(call?.args[0]).toBe('user-1/7/a.jpg');
    expect(Number(call?.args[1])).toBeLessThanOrEqual(300);
  });
});
