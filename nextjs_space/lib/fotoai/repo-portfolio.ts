// Owner-scoped access to fotoai_portfolio_analyses (select/insert/delete for users; no update).
// Portfolio photos are never stored (the legacy route kept bytes in memory only).

import { FotoaiValidationError } from './errors.ts';
import { asJsonObject, boundedLimit, ownerFilter, ownerId } from './repo-ai-common.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_PORTFOLIO = 'fotoai_portfolio_analyses';

export interface PortfolioAnalysisRow {
  id: string;
  user_id: string;
  photo_count: number;
  analysis: Record<string, unknown>;
  analysis_date: string;
}

export function createPortfolioRepo(client: FotoaiSupabaseClient) {
  return {
    async list(scope: OwnerScope, opts: { limit?: number } = {}): Promise<PortfolioAnalysisRow[]> {
      return client.restSelect<PortfolioAnalysisRow>(T_PORTFOLIO, {
        ...ownerFilter(scope),
        select: 'id,user_id,photo_count,analysis,analysis_date',
        order: 'analysis_date.desc',
        limit: boundedLimit(opts.limit, 10, 50),
      }, scope.accessToken);
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

    async create(scope: OwnerScope, input: { photoCount: number; analysis: unknown }): Promise<PortfolioAnalysisRow> {
      if (!Number.isInteger(input.photoCount) || input.photoCount < 1) {
        throw new FotoaiValidationError('photoCount must be a positive integer');
      }
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
