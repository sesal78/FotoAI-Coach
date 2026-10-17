// Photo critique creation for the FotoAI Supabase path.
//
// createCritique() is shared by POST /api/fotoai/critiques and (later) the
// submissions auto-critique. It takes EITHER an uploaded photo OR the id of
// one of the caller's own submissions:
//
//   photo        -> RAW/format check, stored under <user>/critiques/<id>/...,
//                   bytes sent to the vision model as a base64 data URL.
//   submissionId -> submission loaded owner-scoped (404 if not ours), its
//                   private key reused, and a short-lived signed URL sent to
//                   the vision model instead of bytes.
//
// The row is inserted once, complete (users have no UPDATE on the table),
// then critique XP is awarded through the guarded XP service.

import { randomUUID } from 'node:crypto';
import { FotoaiUpstreamError, FotoaiValidationError } from './errors.ts';
import type { FotoaiDeps } from './handlers/shared.ts';
import { photoExtensionFromFilename } from './object-keys.ts';
import { type IncomingPhoto, validateIncomingPhoto } from './photos.ts';
import { createCritiquesRepo, type CritiqueRow, type NewCritique } from './repo-critiques.ts';
import type { OwnerScope } from './repository.ts';
import type { XpAwardResult } from './xp.ts';

export interface CreateCritiqueInput {
  photo?: IncomingPhoto | null;
  submissionId?: string | null;
  challengeText?: string | null;
}

export interface CritiqueDto {
  id: string;
  submissionId: string | null;
  photoUrl: string | null;
  technicalScore: number;
  compositionScore: number;
  creativeScore: number;
  overallScore: number;
  technicalFeedback: string;
  compositionFeedback: string;
  creativeFeedback: string;
  strengths: string[];
  improvements: string[];
  suggestedSettings: string;
  critiqueDate: string;
}

export const MAX_CHALLENGE_TEXT_LENGTH = 2000;
/** Signed URL lifetime for the vision model fetch (seconds). */
export const VISION_URL_TTL_SECONDS = 120;
/** Signed URL lifetime for photos shown in the critique list (seconds, max 300). */
export const DISPLAY_URL_TTL_SECONDS = 300;

const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw', 'raw'];
const VISION_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
/** Extensions a stored submission photo may have to be sent to the vision model by URL. */
const VISION_URL_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_FEEDBACK_LENGTH = 5000;
const MAX_LIST_ITEMS = 10;
const MAX_LIST_ITEM_LENGTH = 500;

const RAW_UPLOAD_MESSAGE = 'RAW files cannot be analysed directly. Please export as JPEG or PNG first, then upload for critique.';
const RAW_SUBMISSION_MESSAGE = 'This photo appears to be a RAW file. Please export as JPEG or PNG first for critique.';

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPngBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x89 && bytes[1] === 0x50;
}

/**
 * Legacy vision-format rule: a RAW extension or a non-web MIME type is only
 * accepted when the bytes are really JPEG or PNG. Returns the MIME type to
 * label the data URL with (detected from magic bytes where possible).
 */
export function visionMimeForUpload(photo: Pick<IncomingPhoto, 'name' | 'type'>, bytes: Uint8Array): string {
  const reportedMime = photo.type || 'image/jpeg';
  const ext = photoExtensionFromFilename(photo.name) ?? '';
  const jpeg = isJpegBytes(bytes);
  const png = isPngBytes(bytes);
  const needsMagic = RAW_EXTENSIONS.includes(ext) || !VISION_MIME_TYPES.includes(reportedMime);
  if (needsMagic && !jpeg && !png) throw new FotoaiValidationError(RAW_UPLOAD_MESSAGE);
  if (jpeg) return 'image/jpeg';
  if (png) return 'image/png';
  return reportedMime.startsWith('image/') ? reportedMime : 'image/jpeg';
}

function cleanChallengeText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new FotoaiValidationError('challengeText must be a string');
  const text = value.trim();
  if (text.length > MAX_CHALLENGE_TEXT_LENGTH) {
    throw new FotoaiValidationError(`challengeText must be at most ${MAX_CHALLENGE_TEXT_LENGTH} characters`);
  }
  return text || undefined;
}

function score(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function text(value: unknown, max = MAX_FEEDBACK_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t.slice(0, max) : null;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, MAX_LIST_ITEM_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, MAX_LIST_ITEMS);
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

/**
 * Creates one critique for the session principal. Throws FotoaiError for bad
 * input (400), a submission that is not ours (404), and a failed vision call
 * (502). An uploaded photo is removed again if the critique is not saved.
 */
export async function createCritique(
  deps: FotoaiDeps,
  principal: OwnerScope,
  input: CreateCritiqueInput,
): Promise<{ critique: CritiqueRow; xp: XpAwardResult[] }> {
  const photo = input.photo ?? null;
  const submissionIdInput = input.submissionId ?? null;
  if (photo && submissionIdInput) {
    throw new FotoaiValidationError('Send either a photo or a submissionId, not both');
  }
  if (!photo && !submissionIdInput) {
    throw new FotoaiValidationError('Either photo file or submissionId is required');
  }
  const challengeText = cleanChallengeText(input.challengeText);

  const critiqueId = randomUUID();
  let imageUrl: string;
  let photoObjectKey: string;
  let submissionId: string | null = null;
  let uploadedKey: string | null = null;

  if (photo) {
    validateIncomingPhoto(photo);
    const bytes = await photo.bytes();
    const mime = visionMimeForUpload(photo, bytes); // 400 before anything is stored
    const stored = await deps.photos.storeFeaturePhoto(principal, 'critiques', critiqueId, {
      ...photo,
      bytes: async () => bytes,
    });
    uploadedKey = stored.objectKey;
    photoObjectKey = stored.objectKey;
    imageUrl = `data:${mime};base64,${toBase64(stored.data)}`;
  } else {
    const submission = await deps.repo.getSubmission(principal, submissionIdInput as string); // 404 if not ours
    if (!submission.photo_object_key) {
      throw new FotoaiValidationError('Submission has no photo to critique');
    }
    const ext = photoExtensionFromFilename(submission.photo_object_key) ?? '';
    if (!VISION_URL_EXTENSIONS.includes(ext)) {
      throw new FotoaiValidationError(RAW_SUBMISSION_MESSAGE);
    }
    const signed = await deps.photos.signSubmissionPhoto(principal, submission.id, VISION_URL_TTL_SECONDS);
    submissionId = submission.id;
    photoObjectKey = submission.photo_object_key;
    imageUrl = signed.url;
  }

  let critique: CritiqueRow;
  try {
    const [preferences, gearList] = await Promise.all([
      deps.repo.getPreferences(principal),
      deps.repo.listGear(principal),
    ]);
    const gear = gearList.slice(0, 20).map((g) => `${g.brand} ${g.model}`);

    let result: Record<string, unknown>;
    try {
      const raw = await deps.services.ai.critiquePhoto({
        imageDataUri: imageUrl,
        skillLevel: preferences.skillLevel,
        challengeText,
        gear,
      });
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('critique result is not an object');
      }
      result = raw as unknown as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new FotoaiUpstreamError(0, `Photo critique failed: ${message.slice(0, 200)}`);
    }

    const row: NewCritique = {
      id: critiqueId,
      submissionId,
      photoObjectKey,
      technicalScore: score(result.technicalScore),
      compositionScore: score(result.compositionScore),
      creativeScore: score(result.creativeScore),
      overallScore: score(result.overallScore),
      technicalFeedback: text(result.technicalFeedback),
      compositionFeedback: text(result.compositionFeedback),
      creativeFeedback: text(result.creativeFeedback),
      strengths: textList(result.strengths),
      improvements: textList(result.improvements),
      suggestedSettings: text(result.suggestedSettings, 2000),
    };
    critique = await createCritiquesRepo(deps.client).insertCritique(principal, row);
  } catch (err) {
    if (uploadedKey) {
      await deps.photos.removeOwnedObject(principal, uploadedKey).catch((cleanupErr: unknown) => {
        deps.log?.('warn', 'Could not remove critique photo after a failed critique', {
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      });
    }
    throw err;
  }

  // The critique is saved; an XP failure must not lose it (legacy: fire-and-forget).
  let xp: XpAwardResult[] = [];
  try {
    xp = await deps.xp.awardCritiqueXP(principal, {
      technical: critique.technical_score ?? 0,
      composition: critique.composition_score ?? 0,
      creative: critique.creative_score ?? 0,
    }, critique.id);
  } catch (err) {
    deps.log?.('warn', 'XP award (critique) failed', { error: err instanceof Error ? err.message : String(err) });
  }

  return { critique, xp };
}

/** Maps a row the caller loaded owner-scoped to the page shape, with a signed photo URL. */
export async function toCritiqueDto(deps: FotoaiDeps, principal: OwnerScope, row: CritiqueRow): Promise<CritiqueDto> {
  let photoUrl: string | null = null;
  try {
    photoUrl = await deps.photos.signOwnedKey(principal, row.photo_object_key, DISPLAY_URL_TTL_SECONDS);
  } catch (err) {
    deps.log?.('warn', 'Could not sign critique photo', {
      critiqueId: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return {
    id: row.id,
    submissionId: row.submission_id ?? null,
    photoUrl,
    technicalScore: row.technical_score ?? 0,
    compositionScore: row.composition_score ?? 0,
    creativeScore: row.creative_score ?? 0,
    overallScore: row.overall_score ?? 0,
    technicalFeedback: row.technical_feedback ?? '',
    compositionFeedback: row.composition_feedback ?? '',
    creativeFeedback: row.creative_feedback ?? '',
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    improvements: Array.isArray(row.improvements) ? row.improvements : [],
    suggestedSettings: row.suggested_settings ?? '',
    critiqueDate: String(row.critique_date ?? ''),
  };
}
