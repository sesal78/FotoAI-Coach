// Privileged Storage helpers for v2 photos (service role). Users have no Storage policy for
// photos: the server makes a one-time signed upload link for an exact key, checks the uploaded
// object, and makes short signed read links. Every helper checks the key belongs to the caller's
// photos path before it touches Storage, and none logs a key, a token or a URL.

import { createServiceClient } from '@fotoai/db/service';
import type { ServerEnv } from '@fotoai/env';

import { ApiError } from '../handler.ts';

export const PHOTO_BUCKET = 'fotoai-submissions';
export const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw', 'raw'] as const;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PHOTO_KEY = new RegExp(`^(${UUID})/photos/${UUID}/[a-z0-9-]+\\.(${PHOTO_EXTENSIONS.join('|')})$`);
const MAX_READ_TTL = 300;

type StorageEnv = Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_SERVICE_ROLE_KEY'>;

/** The key must be `<userId>/photos/<photoId>/<slug>.<ext>`, owned by the caller. */
function checkKey(userId: string, key: string): void {
  const match = PHOTO_KEY.exec(key);
  if (!match || match[1] !== userId.toLowerCase()) throw new ApiError('validation', 'Not a photo key of this user');
}

const bucket = (env: StorageEnv) => createServiceClient(env).storage.from(PHOTO_BUCKET);

/** A one-time upload link for the exact key (upsert, so a retried create gets a working link). */
export async function signedUploadUrl(env: StorageEnv, userId: string, key: string): Promise<{ url: string; token: string; path: string }> {
  checkKey(userId, key);
  const { data, error } = await bucket(env).createSignedUploadUrl(key, { upsert: true });
  if (error || !data) throw new ApiError('upstream', 'Could not create the upload link');
  return { url: data.signedUrl, token: data.token, path: data.path };
}

/** The stored object's size and type, or null when nothing was uploaded. */
export async function objectInfo(env: StorageEnv, userId: string, key: string): Promise<{ bytes: number; mime: string } | null> {
  checkKey(userId, key);
  const { data, error } = await bucket(env).info(key);
  if (error || !data) {
    const status = (error as { status?: number; statusCode?: string | number } | null)?.status ?? Number((error as { statusCode?: string } | null)?.statusCode);
    if (status === 400 || status === 404) return null;
    if (error && /not.?found/i.test(error.message)) return null;
    throw new ApiError('upstream', 'Could not check the upload');
  }
  return { bytes: data.size ?? 0, mime: data.contentType ?? 'application/octet-stream' };
}

/** A signed read link, at most 5 minutes. */
export async function signedReadUrl(env: StorageEnv, userId: string, key: string, ttlSeconds: number): Promise<string> {
  checkKey(userId, key);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_READ_TTL) throw new ApiError('validation', 'Read links last 1..300 seconds');
  const { data, error } = await bucket(env).createSignedUrl(key, ttlSeconds);
  if (error || !data) throw new ApiError('upstream', 'Could not create the read link');
  return data.signedUrl;
}
