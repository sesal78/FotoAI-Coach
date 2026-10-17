// Owner-scoped read access to fotoai_weekly_reports.
//
// The table is read-only for users (rows are written by the weekly scheduler
// with the service role). Every query carries the session user's id filter
// and the user's token, so RLS applies a second time.

import { FotoaiValidationError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

export interface WeeklyReportRow {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  stats: unknown;
  insights: unknown;
  report_date: string;
  [key: string]: unknown;
}

export interface WeeklyReportDto {
  id: string;
  weekStart: string;
  weekEnd: string;
  stats: Record<string, unknown>;
  insights: Record<string, unknown>;
  reportDate: string;
}

const T_WEEKLY_REPORTS = 'fotoai_weekly_reports';
export const DEFAULT_REPORT_LIMIT = 10;
export const MAX_REPORT_LIMIT = 50;

function owner(scope: OwnerScope): Record<string, string> {
  return { user_id: `eq.${requireUuid(scope.userId, 'session user id')}` };
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Parses an optional `limit` query value: positive integer, capped at `max`. */
export function parseListLimit(raw: string | null, fallback: number, max: number): number {
  if (raw === null || raw === '') return fallback;
  if (!/^\d{1,6}$/.test(raw)) throw new FotoaiValidationError('limit must be a positive integer');
  const n = Number(raw);
  if (n < 1) throw new FotoaiValidationError('limit must be a positive integer');
  return Math.min(n, max);
}

export function mapWeeklyReport(row: WeeklyReportRow): WeeklyReportDto {
  return {
    id: row.id,
    weekStart: String(row.week_start ?? ''),
    weekEnd: String(row.week_end ?? ''),
    stats: objectOrEmpty(row.stats),
    insights: objectOrEmpty(row.insights),
    reportDate: String(row.report_date ?? ''),
  };
}

export function createInsightsRepo(client: FotoaiSupabaseClient) {
  return {
    /** Newest first, like the legacy route. */
    async listWeeklyReports(scope: OwnerScope, opts: { limit?: number } = {}): Promise<WeeklyReportDto[]> {
      const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? DEFAULT_REPORT_LIMIT)), MAX_REPORT_LIMIT);
      const rows = await client.restSelect<WeeklyReportRow>(
        T_WEEKLY_REPORTS,
        {
          ...owner(scope),
          select: 'id,user_id,week_start,week_end,stats,insights,report_date',
          order: 'report_date.desc',
          limit: String(limit),
        },
        scope.accessToken,
      );
      return rows.map(mapWeeklyReport);
    },
  };
}

export type FotoaiInsightsRepo = ReturnType<typeof createInsightsRepo>;
