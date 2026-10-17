// FotoAI portfolio handlers (owner-scoped). Replaces app/api/portfolio.
//
//   GET  /api/fotoai/portfolio?limit=        list own analyses
//   POST /api/fotoai/portfolio  (multipart)  photo_0..photo_19 (3-20 photos) -> per-photo
//                                            assessments (max 5 at a time) + meta-analysis
//
// Photos are NOT stored: like the legacy route, bytes stay in memory only.
// Rate limit: 3 analyses per session user per day, where "day" is the legacy
// definition (since local midnight of the server clock). Reserve-first, so
// parallel POSTs cannot bypass it: before any LLM call the request inserts a
// pending row, then counts today's rows; above the limit it deletes its row
// and answers 429. The row is also deleted when the LLM fails, and after the
// finished analysis is inserted as a new row (users have no UPDATE grant on
// this table). Concurrent requests may both be refused; never both admitted
// past the limit.
// Note: the whole multipart body is capped at MAX_UPLOAD_REQUEST_BYTES (51 MB).

import { MAX_UPLOAD_REQUEST_BYTES, readBoundedFormData } from '../bounded-body.ts';
import { FotoaiError, FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { createPortfolioRepo, type PortfolioAnalysisRow, type PortfolioRepo } from '../repo-portfolio.ts';
import type { OwnerScope } from '../repository.ts';
import type { PortfolioPhotoAssessment } from '../../types.ts';
import { callAi, loadAiContext, parseLimit, toDataUri } from './ai-inputs.ts';
import { type DepsProvider, type FotoaiDeps, json, requirePrincipal, withFotoai } from './shared.ts';

export const PORTFOLIO_MAX_PHOTOS = 20;
export const PORTFOLIO_MIN_PHOTOS = 3;
export const PORTFOLIO_MAX_ANALYSES_PER_DAY = 3;
export const PORTFOLIO_MAX_CONCURRENT = 5;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per photo (legacy)

export class FotoaiRateLimitError extends FotoaiError {
  constructor(message: string) {
    super(429, 'rate_limited', message);
    this.name = 'FotoaiRateLimitError';
  }
}

function startOfLocalDay(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function rateLimited(): FotoaiRateLimitError {
  return new FotoaiRateLimitError(`Rate limit: maximum ${PORTFOLIO_MAX_ANALYSES_PER_DAY} portfolio analyses per day`);
}

/** Deletes the reservation. Never throws: the outcome of the request stands. */
async function releaseReservation(deps: FotoaiDeps, repo: PortfolioRepo, scope: OwnerScope, id: string): Promise<void> {
  try {
    await repo.deleteOwn(scope, id);
  } catch (err) {
    deps.log?.('error', 'Portfolio reservation could not be deleted', { error: err instanceof Error ? err.message.slice(0, 200) : String(err) });
  }
}

function collectPhotos(form: FormData): File[] {
  for (const key of form.keys()) {
    const match = /^photo_(\d+)$/.exec(key);
    if (match && Number(match[1]) >= PORTFOLIO_MAX_PHOTOS) {
      throw new FotoaiValidationError(`Maximum ${PORTFOLIO_MAX_PHOTOS} photos allowed`);
    }
  }
  const photos: File[] = [];
  for (let i = 0; i < PORTFOLIO_MAX_PHOTOS; i++) {
    const value = form.get(`photo_${i}`);
    if (value === null) continue;
    if (typeof value === 'string') throw new FotoaiValidationError(`photo_${i} must be a file`);
    if ((value as File).size > 0) photos.push(value as File);
  }
  if (photos.length < PORTFOLIO_MIN_PHOTOS) {
    throw new FotoaiValidationError(`At least ${PORTFOLIO_MIN_PHOTOS} photos required (received ${photos.length})`);
  }
  photos.forEach((photo, i) => {
    if (!ALLOWED_MIME_TYPES.includes(photo.type)) {
      throw new FotoaiValidationError(`Photo ${i + 1}: invalid file type. Allowed: JPEG, PNG, WebP, HEIC`);
    }
    if (photo.size > MAX_FILE_SIZE) {
      throw new FotoaiValidationError(`Photo ${i + 1}: file too large. Maximum 10 MB per photo`);
    }
  });
  return photos;
}

export function createPortfolioHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const limit = parseLimit(params, 10, 50);
      const rows = await createPortfolioRepo(deps.client).list(principal, { limit });
      return json({
        analyses: rows.map((row) => ({
          id: row.id,
          photoCount: row.photo_count,
          analysis: row.analysis,
          analysisDate: row.analysis_date,
        })),
      });
    }),

    create: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const repo = createPortfolioRepo(deps.client);

      // Cheap early refusal before the body is read. Counts only the session
      // user's own rows (owner filter + RLS). The reservation below is the guard.
      const since = startOfLocalDay(new Date());
      if (await repo.countOwnSince(principal, since, PORTFOLIO_MAX_ANALYSES_PER_DAY) >= PORTFOLIO_MAX_ANALYSES_PER_DAY) {
        throw rateLimited();
      }

      const form = await readBoundedFormData(request, MAX_UPLOAD_REQUEST_BYTES);
      assertNoBrowserIdentity(form);
      const photos = collectPhotos(form);

      const reservation = await repo.reserve(principal, photos.length);
      try {
        // Our own reservation is included: more than the limit means we lost.
        if (await repo.countOwnSince(principal, since, PORTFOLIO_MAX_ANALYSES_PER_DAY + 1) > PORTFOLIO_MAX_ANALYSES_PER_DAY) {
          throw rateLimited();
        }
        const row = await analyse(deps, repo, principal, photos);
        return json({ id: row.id, analysis: row.analysis }, { status: 201 });
      } finally {
        // On success the final row already exists, so the count never dips below the truth.
        await releaseReservation(deps, repo, principal, reservation.id);
      }
    }),
  };
}

/** Vision assessments + meta-analysis, then the finished row (a new insert). */
async function analyse(deps: FotoaiDeps, repo: PortfolioRepo, principal: OwnerScope, photos: File[]): Promise<PortfolioAnalysisRow> {
  const { skillLevel } = await loadAiContext(deps, principal);
  const imageDataUris: string[] = [];
  for (const photo of photos) {
    imageDataUris.push(toDataUri(new Uint8Array(await photo.arrayBuffer()), photo.type || 'image/jpeg'));
  }

  // Step 1: per-image assessments, at most PORTFOLIO_MAX_CONCURRENT at a time.
  const assessments: PortfolioPhotoAssessment[] = [];
  for (let batch = 0; batch < imageDataUris.length; batch += PORTFOLIO_MAX_CONCURRENT) {
    const results = await Promise.all(imageDataUris
      .slice(batch, batch + PORTFOLIO_MAX_CONCURRENT)
      .map((uri, offset) => callAi('assessPortfolioPhoto', () =>
        deps.services.ai.assessPortfolioPhoto({ imageDataUri: uri, index: batch + offset, skillLevel }))));
    assessments.push(...results);
  }

  // Step 2: text-only meta-analysis over the assessments.
  const meta = await callAi('analyzePortfolioMeta', () =>
    deps.services.ai.analyzePortfolioMeta({ assessments, skillLevel, photoCount: photos.length }));

  const analysis = { photoAssessments: assessments, ...meta };
  return repo.create(principal, { photoCount: photos.length, analysis });
}
