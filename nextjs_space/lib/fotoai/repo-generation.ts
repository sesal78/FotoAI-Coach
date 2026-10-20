// Owner-scoped data access for challenge generation (user token + RLS).
//
// Used by POST /api/fotoai/challenges/generate, /challenges/sync, /chat and
// /itineraries. Every read filters user_id = scope.userId, every insert writes
// user_id = scope.userId, and the session token is forwarded so Postgres RLS
// applies the same rule again.

import { issuedFieldForChallengeType } from '@fotoai/core';

import { FotoaiNotFoundError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import type { ChallengeRow, OwnerScope, ProgressRow } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_CHALLENGES = 'fotoai_daily_challenges';
const T_PREFERENCES = 'fotoai_user_preferences';
const T_GEAR = 'fotoai_user_gear';
const T_PROGRESS = 'fotoai_user_progress';

export const CHATBOT_CHALLENGE_TYPE = 'CHATBOT_GENERATED';

/** Every column of fotoai_user_preferences the generators (and the cron job) may need. */
export interface GenerationPreferences {
  skillLevel: string;
  photographyInterests: string[];
  avoidsStyles: string[];
  workDays: string[];
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  primaryPhotoDay: string;
  secondaryPhotoDays: string[];
  lunchBreakPhotography: boolean;
  eveningPhotography: boolean;
  wfhFlexibility: boolean;
  adaptToWeather: boolean;
  adaptToCalendar: boolean;
  officeLocation: string | null;
  homeLocation: string | null;
  currentLocation: string | null;
}

const PREFERENCE_COLUMNS = [
  'skill_level', 'photography_interests', 'avoids_styles', 'work_days', 'work_start_time', 'work_end_time',
  'lunch_start_time', 'lunch_end_time', 'primary_photo_day', 'secondary_photo_days', 'lunch_break_photography',
  'evening_photography', 'wfh_flexibility', 'adapt_to_weather', 'adapt_to_calendar', 'office_location',
  'home_location', 'current_location',
].join(',');

// The per-type "issued" counter map lives in @fotoai/core (refactor 3B) so v2 counts the same way.
export { issuedFieldForChallengeType } from '@fotoai/core';

function owner(scope: OwnerScope): Record<string, string> {
  return { user_id: `eq.${requireUuid(scope.userId, 'session user id')}` };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function mapPreferences(row: Record<string, unknown>): GenerationPreferences {
  return {
    skillLevel: text(row.skill_level, 'intermediate'),
    photographyInterests: strings(row.photography_interests),
    avoidsStyles: strings(row.avoids_styles),
    workDays: strings(row.work_days),
    workStartTime: text(row.work_start_time, '09:00'),
    workEndTime: text(row.work_end_time, '17:00'),
    lunchStartTime: text(row.lunch_start_time, '12:00'),
    lunchEndTime: text(row.lunch_end_time, '13:00'),
    primaryPhotoDay: text(row.primary_photo_day, 'Saturday'),
    secondaryPhotoDays: strings(row.secondary_photo_days),
    lunchBreakPhotography: bool(row.lunch_break_photography, true),
    eveningPhotography: bool(row.evening_photography, true),
    wfhFlexibility: bool(row.wfh_flexibility, true),
    adaptToWeather: bool(row.adapt_to_weather, true),
    adaptToCalendar: bool(row.adapt_to_calendar, true),
    officeLocation: nullableText(row.office_location),
    homeLocation: nullableText(row.home_location),
    currentLocation: nullableText(row.current_location),
  };
}

export function createGenerationRepo(client: FotoaiSupabaseClient) {
  return {
    /** The caller's preferences, or null when they never saved any. */
    async getPreferences(scope: OwnerScope): Promise<GenerationPreferences | null> {
      const rows = await client.restSelect<Record<string, unknown>>(
        T_PREFERENCES, { ...owner(scope), select: PREFERENCE_COLUMNS, limit: '1' }, scope.accessToken,
      );
      return rows[0] ? mapPreferences(rows[0]) : null;
    },

    /** The caller's gear as "Brand Model" strings (bounded). */
    async listGearNames(scope: OwnerScope): Promise<string[]> {
      const rows = await client.restSelect<{ brand?: unknown; model?: unknown }>(
        T_GEAR, { ...owner(scope), select: 'brand,model', order: 'created_at.desc', limit: '100' }, scope.accessToken,
      );
      return rows.map((g) => `${String(g.brand ?? '')} ${String(g.model ?? '')}`.trim()).filter(Boolean);
    },

    /** Texts of the caller's most recent challenges, so the LLM avoids repeats. */
    async listRecentChallengeTexts(scope: OwnerScope, limit = 5): Promise<string[]> {
      const rows = await client.restSelect<ChallengeRow>(
        T_CHALLENGES,
        { ...owner(scope), select: 'challenge_text', order: 'created_at.desc', limit: String(Math.min(Math.max(1, limit), 20)) },
        scope.accessToken,
      );
      return rows.map((r) => r.challenge_text).filter((t): t is string => typeof t === 'string');
    },

    /**
     * The caller's pending, non-chatbot challenge issued at or after `since`.
     * The not-equal and >= filters run here, over a bounded list of the
     * newest pending rows.
     */
    async findPendingIssuedSince(scope: OwnerScope, since: Date): Promise<ChallengeRow | null> {
      const rows = await client.restSelect<ChallengeRow>(
        T_CHALLENGES,
        { ...owner(scope), status: 'eq.pending', select: '*', order: 'issued_date.desc', limit: '20' },
        scope.accessToken,
      );
      return rows.find((r) => r.challenge_type !== CHATBOT_CHALLENGE_TYPE
        && new Date(r.issued_date).getTime() >= since.getTime()) ?? null;
    },

    /** The caller's newest pending challenge of any type (sync status). */
    async latestPending(scope: OwnerScope): Promise<ChallengeRow | null> {
      const rows = await client.restSelect<ChallengeRow>(
        T_CHALLENGES,
        { ...owner(scope), status: 'eq.pending', select: '*', order: 'created_at.desc', limit: '1' },
        scope.accessToken,
      );
      return rows[0] ?? null;
    },

    /** The caller's pending chatbot challenge with exactly this text, if any (to avoid duplicates). */
    async findPendingChatbotByText(scope: OwnerScope, challengeText: string): Promise<ChallengeRow | null> {
      const rows = await client.restSelect<ChallengeRow>(
        T_CHALLENGES,
        {
          ...owner(scope), status: 'eq.pending', challenge_type: `eq.${CHATBOT_CHALLENGE_TYPE}`,
          challenge_text: `eq.${challengeText}`, select: '*', limit: '1',
        },
        scope.accessToken,
      );
      return rows[0] ?? null;
    },

    async insertChallenge(scope: OwnerScope, row: Record<string, unknown>): Promise<ChallengeRow> {
      return client.restInsert<ChallengeRow>(
        T_CHALLENGES, { ...row, user_id: requireUuid(scope.userId, 'session user id') }, scope.accessToken,
      );
    },

    async updateChallenge(scope: OwnerScope, challengeId: string, patch: Record<string, unknown>): Promise<ChallengeRow> {
      const id = requireUuid(challengeId, 'challengeId');
      const safe = { ...patch };
      delete safe.user_id; // owner and id never change
      delete safe.id;
      const rows = await client.restUpdate<ChallengeRow>(
        T_CHALLENGES, { ...owner(scope), id: `eq.${id}` }, safe, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Challenge not found');
      return rows[0];
    },

    /**
     * Get-or-create the caller's progress row, then add one to
     * total_challenges_issued and to the per-type *_issued counter.
     */
    async incrementIssued(scope: OwnerScope, challengeType: string, now: Date = new Date()): Promise<ProgressRow> {
      const found = await client.restSelect<ProgressRow>(
        T_PROGRESS, { ...owner(scope), select: '*', limit: '1' }, scope.accessToken,
      );
      const progress = found[0] ?? await client.restInsert<ProgressRow>(
        T_PROGRESS, { user_id: requireUuid(scope.userId, 'session user id') }, scope.accessToken,
      );
      const patch: Record<string, unknown> = {
        total_challenges_issued: (progress.total_challenges_issued || 0) + 1,
        last_challenge_date: now.toISOString(),
        updated_at: now.toISOString(),
      };
      const typeField = issuedFieldForChallengeType(challengeType);
      if (typeField) patch[typeField] = ((progress[typeField] as number) || 0) + 1;
      const rows = await client.restUpdate<ProgressRow>(
        T_PROGRESS, { ...owner(scope), id: `eq.${progress.id}` }, patch, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Progress row not found');
      return rows[0];
    },
  };
}

export type GenerationRepo = ReturnType<typeof createGenerationRepo>;
