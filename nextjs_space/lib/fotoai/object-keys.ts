// Private photo object keys.
//
// A submission photo is stored in the private bucket fotoai-submissions under
//   <ownerUserId>/submissions/<submissionId>/<random>.<ext>
// The database stores this KEY, never a URL. Access happens only through a
// short-lived signed URL created by the server after an ownership check.
//
// The pattern below is duplicated verbatim in
//   supabase/migrations/fotoai/0001_fotoai_schema.sql (check constraint) and
//   supabase/migrations/fotoai/0003_fotoai_storage.sql (Storage insert policy).
// tests/fotoai/migrations.test.ts fails if the three copies drift.

import { randomUUID } from 'node:crypto';
import { FotoaiForbiddenError, FotoaiValidationError } from './errors.ts';

export const PHOTO_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'heic',
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw', 'raw',
] as const;

const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Exact regex source shared with the SQL files (keep in sync). */
export const SUBMISSION_OBJECT_KEY_PATTERN =
  `^${UUID_SOURCE}/submissions/${UUID_SOURCE}/[a-z0-9-]+\\.(${PHOTO_EXTENSIONS.join('|')})$`;

const SUBMISSION_OBJECT_KEY_RE = new RegExp(SUBMISSION_OBJECT_KEY_PATTERN);
const UUID_RE = new RegExp(`^${UUID_SOURCE}$`);
const MAX_KEY_LENGTH = 256;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Validates an id that arrived from the client. Lowercases it. */
export function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new FotoaiValidationError(`${label} is required`);
  }
  const normalized = value.trim().toLowerCase();
  if (!UUID_RE.test(normalized)) {
    throw new FotoaiValidationError(`${label} must be a UUID`);
  }
  return normalized;
}

export function photoExtensionFromFilename(filename: string): string | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename || '');
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return (PHOTO_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

/**
 * Builds a new object key for the given owner and submission.
 * `random` is injectable for deterministic tests.
 */
export function buildSubmissionObjectKey(
  ownerUserId: string,
  submissionId: string,
  originalFilename: string,
  random: () => string = randomUUID,
): string {
  const owner = requireUuid(ownerUserId, 'ownerUserId');
  const submission = requireUuid(submissionId, 'submissionId');
  const ext = photoExtensionFromFilename(originalFilename);
  if (!ext) {
    throw new FotoaiValidationError(
      `Unsupported photo extension. Allowed: ${PHOTO_EXTENSIONS.join(', ')}`,
    );
  }
  const key = `${owner}/submissions/${submission}/${random().toLowerCase()}.${ext}`;
  assertOwnedObjectKey(key, owner);
  return key;
}

/**
 * Photo kinds other than submissions. Their keys are
 *   <ownerUserId>/<kind>/<rowId>/<random>.<ext>
 * They are uploaded by the server with the service role (the Storage insert
 * policy covers submissions only), so the server builds and checks every key.
 */
export const FEATURE_PHOTO_KINDS = ['critiques', 'reverse', 'editing', 'portfolio'] as const;
export type FeaturePhotoKind = (typeof FEATURE_PHOTO_KINDS)[number];

const FEATURE_OBJECT_KEY_RE = new RegExp(
  `^${UUID_SOURCE}/(${FEATURE_PHOTO_KINDS.join('|')})/${UUID_SOURCE}/[a-z0-9-]+\\.(${PHOTO_EXTENSIONS.join('|')})$`,
);

export function buildFeatureObjectKey(
  ownerUserId: string,
  kind: FeaturePhotoKind,
  rowId: string,
  originalFilename: string,
  random: () => string = randomUUID,
): string {
  const owner = requireUuid(ownerUserId, 'ownerUserId');
  const row = requireUuid(rowId, 'rowId');
  if (!(FEATURE_PHOTO_KINDS as readonly string[]).includes(kind)) {
    throw new FotoaiValidationError('Unknown photo kind');
  }
  const ext = photoExtensionFromFilename(originalFilename);
  if (!ext) {
    throw new FotoaiValidationError(
      `Unsupported photo extension. Allowed: ${PHOTO_EXTENSIONS.join(', ')}`,
    );
  }
  const key = `${owner}/${kind}/${row}/${random().toLowerCase()}.${ext}`;
  assertOwnedFeatureKey(key, owner);
  return key;
}

/** Same rules as assertOwnedObjectKey, for the non-submission photo kinds. */
export function assertOwnedFeatureKey(key: unknown, ownerUserId: string): asserts key is string {
  const owner = requireUuid(ownerUserId, 'ownerUserId');
  if (typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_LENGTH) {
    throw new FotoaiValidationError('Object key is invalid');
  }
  if (!FEATURE_OBJECT_KEY_RE.test(key)) {
    throw new FotoaiValidationError('Object key does not match the photo key format');
  }
  if (key.split('/')[0] !== owner) {
    throw new FotoaiForbiddenError('Object key belongs to another user');
  }
}

/** Accepts a submission key or a feature key owned by `ownerUserId`. */
export function assertOwnedAnyPhotoKey(key: unknown, ownerUserId: string): asserts key is string {
  if (typeof key === 'string' && key.split('/')[1] === 'submissions') {
    assertOwnedObjectKey(key, ownerUserId);
  } else {
    assertOwnedFeatureKey(key, ownerUserId);
  }
}

/**
 * Rejects any key that is not a well-formed submission key owned by `ownerUserId`.
 * - malformed / traversal / wrong shape -> 400 FotoaiValidationError
 * - well-formed but a different owner   -> 403 FotoaiForbiddenError
 */
export function assertOwnedObjectKey(key: unknown, ownerUserId: string): asserts key is string {
  const owner = requireUuid(ownerUserId, 'ownerUserId');

  if (typeof key !== 'string' || key.length === 0) {
    throw new FotoaiValidationError('Object key is required');
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new FotoaiValidationError('Object key is too long');
  }
  if (key !== key.trim() || /[\s\\\u0000-\u001f]/.test(key)) {
    throw new FotoaiValidationError('Object key contains illegal characters');
  }
  if (key.startsWith('/') || key.includes('//') || key.split('/').includes('..') || key.split('/').includes('.')) {
    throw new FotoaiValidationError('Object key contains a path traversal');
  }
  if (!SUBMISSION_OBJECT_KEY_RE.test(key)) {
    throw new FotoaiValidationError('Object key does not match the submission key format');
  }
  const [prefix] = key.split('/');
  if (prefix !== owner) {
    throw new FotoaiForbiddenError('Object key belongs to another user');
  }
}
