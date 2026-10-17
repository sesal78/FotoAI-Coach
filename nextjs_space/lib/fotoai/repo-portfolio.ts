// Owner-scoped access to fotoai_portfolio_analyses (select/insert/delete for users; no update).
// Portfolio photos are never stored (the legacy route kept bytes in memory only).
//
// Daily-limit reservations: a POST first inserts a row whose analysis is
// {status: 'pending'} and counts it, so parallel requests cannot all pass a
// check-then-act limit. Users have no UPDATE grant, so the finished analysis
// is a NEW row and the reservation is deleted afterwards. Pending rows are
// never listed.

import { FotoaiValidationError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import { asJsonObject, boundedLimit, ownerFilter, ownerId } from './repo-ai-common.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_PORTFOLIO = 'fotoai_portfolio_analyses';
export const PORTFOLIO_PENDING_STATUS = 'pending';

export interface PortfolioAnalysisRow {
  id: string;
  user_id: string;
  photo_count: number;
  analysis: Record<string, unknown>;
  analysis_date: string;
}

function isReservation(row: Pick<PortfolioAnalysisRow, 'analysis'>): boolean {
  return asJsonObject(row.analysis).status === PORTFOLIO_PENDING_STATUS;
}

function requirePhotoCount(photoCount: number): void {
  if (!Number.isInteger(photoCount) || photoCount < 1) {
    throw new FotoaiValidationError('photoCount must be a positive integer');
  }
}

export function createPortfolioRepo(client: FotoaiSupabaseClient) {
  return {
    /** Own finished analyses, newest first. In-flight reservations are left out. */
    async list(scope: OwnerScope, opts: { limit?: number } = {}): Promise<PortfolioAnalysisRow[]> {
      const rows = await client.restSelect<PortfolioAnalysisRow>(T_PORTFOLIO, {
        ...ownerFilter(scope),
        select: 'id,user_id,photo_count,analysis,analysis_date',
        order: 'analysis_date.desc',
        limit: boundedLimit(opts.limit, 10, 50),
      }, scope.accessToken);
      return rows.filter((row) => !isReservation(row));
    },

    /**
     * Counts the caller's own analyses dated at or after `since`, up to `max`.
     * Reads the newest `max` own rows and filters by date, so it needs only an
     * equality filter on user_id.
     */
    async countOwnSince(scope: OwnerScope, since: Date, max: number): Promise<number> {
      const rows = await client.restSelect<Pick<PortfolioAnalysisRow, 'id' | 'analysis_date'>>(T_PORTFOLIO, {
        ...ownerFilter(scope),
        select: 'id,analysis_date',
        order: 'analysis_date.desc',
        limit: String(max),
      }, scope.accessToken);
      const sinceMs = since.getTime();
      return rows.filter((row) => Date.parse(row.analysis_date) >= sinceMs).length;
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
