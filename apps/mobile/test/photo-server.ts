// A fake of the live photo routes and the Storage bucket, as 3F reads them: create (a replay of a
// pending photo gives a fresh one-time link; a ready one gives no link), the upload with that link
// only, and confirm (the uploaded size and type must equal the declared ones).

import { ApiClientError } from '../src/lib/api';
import { photo } from './fixtures';

interface Row {
  status: 'pending' | 'ready';
  body: { id: string; source: 'gallery' | 'scan' | 'camera'; mime: string; bytes: number; exif?: Record<string, unknown>; rollId?: string; stepId?: string };
  token: string;
  uploaded: { bytes: number; mime: string } | null;
}

export function fakePhotoServer() {
  const rows = new Map<string, Row>();
  let tokens = 0;
  const creates: unknown[] = [];

  const dto = (row: Row) => photo({ id: row.body.id, source: row.body.source, status: row.status, mime: row.body.mime, bytes: row.body.bytes, rollId: row.body.rollId ?? null });

  const request = jest.fn(async (path: string, opts: { method?: string; body?: unknown } = {}): Promise<unknown> => {
    if (path === '/api/v2/photos' && opts.method === 'POST') {
      const body = opts.body as Row['body'];
      creates.push(body);
      const existing = rows.get(body.id);
      if (existing?.status === 'ready') return { photo: dto(existing) };
      tokens += 1;
      const row: Row = existing ? { ...existing, token: `t${tokens}` } : { status: 'pending', body, token: `t${tokens}`, uploaded: null };
      rows.set(body.id, row);
      return { photo: dto(row), upload: { url: `https://storage.test/upload/${body.id}`, token: row.token, path: `user/${body.id}.jpg` } };
    }
    const confirm = /^\/api\/v2\/photos\/([^/]+)\/confirm$/.exec(path);
    if (confirm && opts.method === 'POST') {
      const row = rows.get(confirm[1]!);
      if (!row) throw new ApiClientError('not_found', 404, 'Photo not found');
      if (row.status === 'ready') return { photo: dto(row) };
      if (!row.uploaded) throw new ApiClientError('validation', 400, 'Nothing was uploaded for this photo');
      if (row.uploaded.bytes !== row.body.bytes || row.uploaded.mime !== row.body.mime) throw new ApiClientError('validation', 400, 'The upload does not match the declared size or type');
      row.status = 'ready';
      return { photo: dto(row) };
    }
    throw new Error(`fake photo server: no route for ${opts.method ?? 'GET'} ${path}`);
  });

  const bucket = {
    uploadToSignedUrl: jest.fn(async (objectPath: string, token: string, body: ArrayBuffer, opts: { contentType: string }) => {
      const row = [...rows.values()].find((r) => `user/${r.body.id}.jpg` === objectPath);
      // Only the newest link works: an older one has run out.
      if (!row || row.token !== token) return { data: null, error: { name: 'StorageApiError', message: 'jwt expired', status: 400, statusCode: '400' } };
      row.uploaded = { bytes: body.byteLength, mime: opts.contentType };
      return { data: { path: objectPath, fullPath: `fotoai-submissions/${objectPath}` }, error: null };
    }),
  };

  return { request, bucket, rows, creates };
}
