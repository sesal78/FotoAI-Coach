// Private photo storage and server-only signing.
//
// Design:
//   * Upload uses the USER token, so Storage RLS (0003) rejects any key that is
//     not under the caller's own user-id prefix.
//   * Signing and deleting use the SERVICE ROLE, but only after this module has
//     (1) loaded the submission through the owner-scoped repository (404 for any
//     other owner) and (2) re-validated that the stored key starts with the
//     caller's user id. A row whose key points elsewhere is refused with 403 and
//     never signed.
//   * Signed URLs are short-lived (default 60 s) and are never persisted.

import type { FotoaiEnv } from './env.ts';
import { FotoaiValidationError } from './errors.ts';
import { assertOwnedObjectKey, buildSubmissionObjectKey, photoExtensionFromFilename } from './object-keys.ts';
import type { FotoaiRepository, OwnerScope, SubmissionRow } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 60;
export const MAX_SIGNED_URL_TTL_SECONDS = 300;

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
  'image/x-olympus-orf', 'image/x-panasonic-rw2', 'image/x-pentax-pef',
  'image/x-samsung-srw', 'image/x-dcraw',
  'application/octet-stream',
] as const;

export interface IncomingPhoto {
  name: string;
  type: string;
  size: number;
  bytes: () => Promise<Uint8Array>;
}

export interface StoredPhoto {
  objectKey: string;
  mime: string;
  bytes: number;
}

export function validateIncomingPhoto(photo: Pick<IncomingPhoto, 'name' | 'type' | 'size'>): void {
  const ext = photoExtensionFromFilename(photo.name);
  const mimeOk = (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(photo.type);
  if (!ext) {
    throw new FotoaiValidationError('Unsupported photo file extension');
  }
  if (!mimeOk) {
    throw new FotoaiValidationError(`Unsupported photo type "${photo.type}"`);
  }
  if (!(photo.size > 0) || photo.size > MAX_PHOTO_BYTES) {
    throw new FotoaiValidationError('Photo must be between 1 byte and 50 MB');
  }
}

export function createPhotoService(client: FotoaiSupabaseClient, env: FotoaiEnv, repo: FotoaiRepository) {
  return {
    /** Uploads a photo for the caller's submission and returns its private key. */
    async storeSubmissionPhoto(scope: OwnerScope, submissionId: string, photo: IncomingPhoto, random?: () => string): Promise<StoredPhoto> {
      validateIncomingPhoto(photo);
      // Ownership of the submission is checked before any byte is uploaded.
      const submission = await repo.getSubmission(scope, submissionId);
      const objectKey = buildSubmissionObjectKey(scope.userId, submission.id, photo.name, random);
      assertOwnedObjectKey(objectKey, scope.userId);
      const bytes = await photo.bytes();
      if (bytes.byteLength !== photo.size) {
        throw new FotoaiValidationError('Photo size did not match its declared size');
      }
      await client.storageUpload(objectKey, bytes, photo.type, scope.accessToken);
      return { objectKey, mime: photo.type, bytes: bytes.byteLength };
    },

    /** Returns a short-lived signed URL for the caller's own submission photo. */
    async signSubmissionPhoto(scope: OwnerScope, submissionId: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<{ url: string; expiresIn: number; submission: SubmissionRow }> {
      const ttl = Math.min(Math.max(1, Math.floor(ttlSeconds)), MAX_SIGNED_URL_TTL_SECONDS);
      const submission = await repo.getSubmission(scope, submissionId); // 404 for other owners
      if (!submission.photo_object_key) {
        throw new FotoaiValidationError('Submission has no photo');
      }
      // Defense in depth: never sign a key that is not under the caller's prefix,
      // even if the row says it is theirs.
      assertOwnedObjectKey(submission.photo_object_key, scope.userId);
      const url = await client.storageCreateSignedUrl(submission.photo_object_key, ttl);
      return { url, expiresIn: ttl, submission };
    },

    /** Removes an object that the caller has already been proven to own. */
    async removeOwnedObject(scope: OwnerScope, objectKey: string): Promise<void> {
      assertOwnedObjectKey(objectKey, scope.userId);
      await client.storageRemove([objectKey]);
    },

    bucket: env.bucket,
  };
}

export type FotoaiPhotoService = ReturnType<typeof createPhotoService>;
