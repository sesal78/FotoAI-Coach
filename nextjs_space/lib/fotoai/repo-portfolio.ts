// Owner-scoped access to fotoai_portfolio_analyses (select/insert/delete for users; no update).
// Portfolio photos are never stored (the legacy route kept bytes in memory only).
//
// Daily-limit reservations: a POST first inserts a row whose analysis is
// {status: 'pending'} and counts it, so parallel requests cannot all pass a
// check-then-act limit. Users have no UPDATE grant, so the finished analysis
// is a NEW row and the reservation is deleted afterwards. Pending rows are
// never listed.
//
// A reservation is EXACTLY {status: 'pending'}; a finished analysis always has
// more keys (photoAssessments), so a model result that happens to contain
// status "pending" is still a finished analysis. A reservation older than
// PORTFOLIO_RESERVATION_TTL_MS is left over from a release that failed: it no
// longer counts toward the limit, and countOwnSince() reports it so the
// caller can delete it. Reads page with offset (newest first), so skipped
// reservations never shorten a page.

import { FotoaiValidationError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import { asJsonObject, boundedLimit, ownerFilter, ownerId } from './repo-ai-common.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_PORTFOLIO = 'fotoai_portfolio_analyses';
export const PORTFOLIO_PENDING_STATUS = 'pending';
/** Far longer than a normal analysis (20 photos: 4 vision batches + meta). The LLM calls have no
 *  timeout, so a hung analysis older than this stops counting: at worst one extra analysis that day. */
export const PORTFOLIO_RESERVATION_TTL_MS = 15 * 60 * 1000;
/** Upper bound on pages read by one list or count. */
const MAX_SCAN_PAGES = 5;

export interface PortfolioAnalysisRow {
  id: string;
  user_id: string;
  photo_count: number;
  analysis: Record<string, unknown>;
  analysis_date: string;
}

function isReservation(row: Pick<PortfolioAnalysisRow, 'analysis'>): boolean {
  const analysis = asJsonObject(row.analysis);
  return Object.keys(analysis).length === 1 && analysis.status === PORTFOLIO_PENDING_STATUS;
}

type ScanRow = Pick<PortfolioAnalysisRow, 'id' | 'analysis' | 'analysis_date'>;

function requirePhotoCount(photoCount: number): void {
  if (!Number.isInteger(photoCount) || photoCount < 1) {
    throw new FotoaiValidationError('photoCount must be a positive integer');
  }
}

/**
 * Visits the caller's own rows newest first, `pageSize` per page, until
 * `visit` returns false, a page is short, or MAX_SCAN_PAGES were read. Only an
 * equality filter on user_id is used. Rows seen twice (a new row shifts the
 * offsets) are visited once.
 */
async function scanOwn<T extends ScanRow>(
  client: FotoaiSupabaseClient, scope: OwnerScope, select: string, pageSize: number, visit: (row: T) => boolean,
): Promise<void> {
  const seen = new Set<string>();
  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const rows = await client.restSelect<T>(T_PORTFOLIO, {
      ...ownerFilter(scope),
      select,
      order: 'analysis_date.desc',
      limit: String(pageSize),
      offset: String(page * pageSize),
    }, scope.accessToken);
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      if (!visit(row)) return;
    }
    if (rows.length < pageSize) return;
  }
}

export function createPortfolioRepo(client: FotoaiSupabaseClient) {
  return {
    /** Own finished analyses, newest first. Reservations are skipped, not counted against the page. */
    async list(scope: OwnerScope, opts: { limit?: number } = {}): Promise<PortfolioAnalysisRow[]> {
      const limit = Number(boundedLimit(opts.limit, 10, 50));
      const found: PortfolioAnalysisRow[] = [];
      await scanOwn<PortfolioAnalysisRow>(client, scope, 'id,user_id,photo_count,analysis,analysis_date', limit, (row) => {
        if (!isReservation(row)) found.push(row);
        return found.length < limit;
      });
      return found;
    },

    /**
     * Counts the caller's own rows dated at or after `since`, up to `max`:
     * finished analyses and live reservations. Stale reservations (older
     * than PORTFOLIO_RESERVATION_TTL_MS at `now`) are not counted; their ids
     * are returned so the caller can delete them.
     */
    async countOwnSince(scope: OwnerScope, since: Date, max: number, now = Date.now()): Promise<{ count: number; staleReservations: string[] }> {
      const sinceMs = since.getTime();
      const staleBefore = now - PORTFOLIO_RESERVATION_TTL_MS;
      const staleReservations: string[] = [];
      let count = 0;
      await scanOwn<ScanRow>(client, scope, 'id,analysis,analysis_date', max, (row) => {
        const date = Date.parse(row.analysis_date);
        if (isReservation(row) && date < staleBefore) {
          staleReservations.push(row.id);
          return true;
        }
        if (date < sinceMs) return false; // every later row is older
        count += 1;
        return count < max;
      });
      return { count, staleReservations };
    },

    /** Inserts the caller's pending reservation; it counts toward the daily limit at once. */
    async reserve(scope: OwnerScope, photoCount: number): Promise<PortfolioAnalysisRow> {
      requirePhotoCount(photoCount);
      return client.restInsert<PortfolioAnalysisRow>(T_PORTFOLIO, {
        user_id: ownerId(scope),
        photo_count: photoCount,
        analysis: { status: PORTFOLIO_PENDING_STATUS },
        analysis_date: new Date().toISOString(),
      }, scope.accessToken);
    },

    /** Deletes one of the caller's rows (id AND user_id). Returns how many rows went. */
    async deleteOwn(scope: OwnerScope, id: string): Promise<number> {
      const rows = await client.restDelete(T_PORTFOLIO, {
        ...ownerFilter(scope),
        id: `eq.${requireUuid(id, 'portfolio analysis id')}`,
      }, scope.accessToken);
      return rows.length;
    },

    async create(scope: OwnerScope, input: { photoCount: number; analysis: unknown }): Promise<PortfolioAnalysisRow> {
      requirePhotoCount(input.photoCount);
      return client.restInsert<PortfolioAnalysisRow>(T_PORTFOLIO, {
        user_id: ownerId(scope),
        photo_count: input.photoCount,
        analysis: asJsonObject(input.analysis),
        analysis_date: new Date().toISOString(),
      }, scope.accessToken);
    },
  };
}

export type PortfolioRepo = ReturnType<typeof createPortfolioRepo>;
