// Sends one waiting photo: create (a replay of a pending photo gives a fresh one-time link), upload
// the bytes with that link straight to Storage, then confirm. Every step is safe to repeat, so a
// photo that failed half way simply runs the whole chain again on the next try: a killed upload,
// or a link that ran out while the phone was offline, needs nothing else.
// No signal or a refused link waits and tries again; a refusal from the server (for example the
// size does not match) moves the photo to "Needs attention". The upload link is never kept.

import { ExifInput, PhotoDto, PhotoResponse, PHOTO_SOURCES } from '@fotoai/contracts';
import { z } from 'zod';

import { AI_TIMEOUT_MS, ApiClientError, type Api } from '../lib/api';
import type { OutboxInput } from './outbox';

export const PHOTO_BUCKET = 'fotoai-submissions';

/** A waiting photo. `file` and `importKey` stay on the phone: they are not sent. */
export interface PhotoBody {
  id: string;
  source: (typeof PHOTO_SOURCES)[number];
  mime: 'image/jpeg';
  bytes: number;
  exif?: ExifInput;
  stepId?: string;
  rollId?: string;
  /** The JPEG to upload, in the app's own folder. */
  file: string;
  /** The gallery photo it came from (see importKey), so the same one is not imported twice. */
  importKey?: string | null;
}

export const photoItem = (body: PhotoBody): OutboxInput => ({ kind: 'photo', method: 'POST', path: '/api/v2/photos', body, key: `photo:${body.id}` });

const CreateAnswer = z.object({ photo: PhotoDto, upload: z.object({ url: z.string(), token: z.string(), path: z.string() }).optional() });

interface StorageFault {
  message?: string;
  status?: number;
  statusCode?: string | number;
}

export interface UploadBucket {
  uploadToSignedUrl: (path: string, token: string, body: ArrayBuffer, options: { contentType: string }) => Promise<{ error: StorageFault | null }>;
}

export interface PhotoSenderDeps {
  request: Api['request'];
  /** The Storage bucket, through the signed-in Supabase client. */
  bucket: () => UploadBucket;
  readFile: (uri: string) => Promise<ArrayBuffer>;
}

const TRY_AGAIN = 'The photo did not finish uploading. FotoAI will try again.';

/**
 * A Storage failure as the sync engine reads it. Its status is never passed on: a 401 from Storage
 * means the link ran out, not that the user is signed out.
 */
function storageFailure(fault: unknown): ApiClientError {
  const f = fault as StorageFault | null;
  // Storage answers many refusals with HTTP 400 and puts the real reason in statusCode ('413' too
  // large, '415' wrong type, '403' a link that ran out): that one decides.
  const own = Number(f?.statusCode);
  const status = Number.isFinite(own) ? own : Number(f?.status);
  // No signal, a Storage fault, or a refused or expired link: the next create gives a fresh link.
  if (!Number.isFinite(status) || [400, 401, 403, 408, 429].includes(status) || status >= 500) return new ApiClientError('upstream', 0, TRY_AGAIN);
  return new ApiClientError('validation', 0, 'Storage did not take this photo. Remove it, then import it again.');
}

export function createPhotoSender(deps: PhotoSenderDeps) {
  return async function sendPhoto(body: PhotoBody): Promise<PhotoResponse> {
    const { file, ...rest } = body;
    const create = { ...rest };
    delete create.importKey;
    const created = await deps.request('/api/v2/photos', { method: 'POST', body: create, schema: CreateAnswer });
    // No link: the photo is already stored (an earlier try got that far).
    if (created.upload) {
      let bytes: ArrayBuffer;
      try {
        bytes = await deps.readFile(file);
      } catch {
        throw new ApiClientError('validation', 0, 'This photo is no longer on this phone. Remove it, then import it again.');
      }
      let result: { error: StorageFault | null };
      try {
        result = await deps.bucket().uploadToSignedUrl(created.upload.path, created.upload.token, bytes, { contentType: body.mime });
      } catch (err) {
        throw storageFailure(err);
      }
      if (result.error) throw storageFailure(result.error);
    }
    // Confirm runs the AI check on the server: it may take longer than a plain request.
    return deps.request(`/api/v2/photos/${encodeURIComponent(body.id)}/confirm`, { method: 'POST', schema: PhotoResponse, timeoutMs: AI_TIMEOUT_MS });
  };
}
