// Challenge generation core, shared by the request path and (later) the
// daily-challenge cron job.
//
// generateChallengeFor(deps, scope, opts) never touches a database client
// directly. It reads and writes only through `deps.data`, a
// GenerationDataAccess<S> whose functions all take the same `scope`:
//
//   * Request path (POST /api/fotoai/challenges/generate): S is the session
//     OwnerScope ({ userId, accessToken }) and `data` is
//     createOwnerGenerationDataAccess(deps), which uses the user token so RLS
//     applies (lib/fotoai/repo-generation.ts + deps.repo.logAgentAction).
//   * Cron path (not built yet): S can be e.g. { userId } and `data` a
//     service-role implementation that filters user_id = scope.userId on every
//     read and writes user_id = scope.userId on every insert. The cron caller
//     supplies the display name in opts.displayName (from adminListUsers).
//
// The rules ported from app/api/challenges/route.ts POST:
//   1. Unless forceGenerate, return the caller's pending non-chatbot challenge
//      issued since local midnight instead of generating a new one.
//   2. Preferences are required (404 otherwise); gear and the last 5 challenge
//      texts feed the prompt; weather is best effort.
//   3. Insert the challenge, bump total + per-type issued counters, log
//      CHALLENGE_SENT.

import { FotoaiNotFoundError, FotoaiUpstreamError, FotoaiValidationError } from './errors.ts';
import type { FotoaiDeps } from './handlers/shared.ts';
import { createGenerationRepo, type GenerationPreferences } from './repo-generation.ts';
import type { ChallengeRow, OwnerScope } from './repository.ts';
import type { FotoaiServices } from './services.ts';

export const GENERATABLE_CHALLENGE_TYPES = [
  'WEEKEND_DEEP_DIVE', 'LUNCH_BREAK', 'AFTER_WORK', 'WFH_MICRO', 'STORY_DRIVEN', 'TECHNICAL_MASTERY',
] as const;
export type GeneratableChallengeType = (typeof GENERATABLE_CHALLENGE_TYPES)[number];

const DEFAULT_TYPE: GeneratableChallengeType = 'WEEKEND_DEEP_DIVE';
const DEFAULT_LOCATION = 'Melbourne, Australia';

/** Data access the generator needs. Every function is scoped by `scope`. */
export interface GenerationDataAccess<S> {
  getPreferences(scope: S): Promise<GenerationPreferences | null>;
  listGearNames(scope: S): Promise<string[]>;
  listRecentChallengeTexts(scope: S, limit: number): Promise<string[]>;
  findPendingIssuedSince(scope: S, since: Date): Promise<ChallengeRow | null>;
  insertChallenge(scope: S, row: Record<string, unknown>): Promise<ChallengeRow>;
  incrementIssued(scope: S, challengeType: string, now: Date): Promise<unknown>;
  logAgentAction(scope: S, actionType: string, details: Record<string, unknown>): Promise<void>;
}

export interface GenerationDeps<S> {
  data: GenerationDataAccess<S>;
  services: Pick<FotoaiServices, 'ai' | 'weather'>;
  now?: () => Date;
  log?: FotoaiDeps['log'];
}

export interface GenerateOptions {
  challengeType?: GeneratableChallengeType;
  forceGenerate?: boolean;
  /** Name used in the prompt. Falls back to "Photographer". */
  displayName?: string | null;
}

export interface GenerateResult {
  challenge: ChallengeRow;
  created: boolean;
}

/** Request-path data access: session token, owner-scoped, RLS applies. */
export function createOwnerGenerationDataAccess(deps: Pick<FotoaiDeps, 'client' | 'repo'>): GenerationDataAccess<OwnerScope> {
  const repo = createGenerationRepo(deps.client);
  return {
    getPreferences: (scope) => repo.getPreferences(scope),
    listGearNames: (scope) => repo.listGearNames(scope),
    listRecentChallengeTexts: (scope, limit) => repo.listRecentChallengeTexts(scope, limit),
    findPendingIssuedSince: (scope, since) => repo.findPendingIssuedSince(scope, since),
    insertChallenge: (scope, row) => repo.insertChallenge(scope, row),
    incrementIssued: (scope, type, now) => repo.incrementIssued(scope, type, now),
    logAgentAction: (scope, type, details) => deps.repo.logAgentAction(scope, type, details),
  };
}

export function parseChallengeType(value: unknown): GeneratableChallengeType {
  if (value === undefined || value === null || value === '') return DEFAULT_TYPE;
  if (typeof value !== 'string' || !(GENERATABLE_CHALLENGE_TYPES as readonly string[]).includes(value)) {
    throw new FotoaiValidationError('challengeType is invalid');
  }
  return value as GeneratableChallengeType;
}

function startOfLocalDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clipList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxLength));
}

function technicalLevel(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

type LlmChallenge = Awaited<ReturnType<FotoaiServices['ai']['generateChallenge']>>;

/** Maps the LLM result to fotoai_daily_challenges columns (bounded, schema-safe). */
export function challengeRowFromLlm(
  data: LlmChallenge,
  ctx: { challengeType: string; location: string; weatherConditions: string | null; issuedAt: Date },
): Record<string, unknown> {
  const challengeText = clip(data?.challengeText, 4000);
  if (!challengeText) throw new FotoaiUpstreamError(0, 'Challenge generator returned no challenge text');
  return {
    challenge_type: ctx.challengeType,
    challenge_text: challengeText,
    difficulty: clip(data.difficulty, 60),
    category: clip(data.category, 60),
    duration: clip(data.duration, 60),
    weather_conditions: ctx.weatherConditions,
    location: ctx.location.slice(0, 200),
    recommended_gear: clipList(data.recommendedGear, 20, 200),
    tips: clip(data.tips, 4000),
    issued_date: ctx.issuedAt.toISOString(),
    status: 'pending',
    shot_list: clipList(data.shotList, 20, 500),
    narrative_context: clip(data.narrativeContext, 4000),
    editing_direction: clip(data.editingDirection, 4000),
    mastery_area: clip(data.masteryArea, 200),
    technical_level: technicalLevel(data.technicalLevel),
    success_criteria: clip(data.successCriteria, 4000),
    what_to_look_for: clip(data.whatToLookFor, 4000),
  };
}

/** Best-effort weather: a failure means "no weather", never a failed request. */
export async function weatherFor(
  services: Pick<FotoaiServices, 'weather'>,
  location: string,
  log?: FotoaiDeps['log'],
) {
  try {
    return await services.weather.getWeather(location);
  } catch (err) {
    log?.('warn', `Weather lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function generateChallengeFor<S>(
  deps: GenerationDeps<S>,
  scope: S,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const now = deps.now?.() ?? new Date();
  const challengeType = opts.challengeType ?? DEFAULT_TYPE;

  if (!opts.forceGenerate) {
    const existing = await deps.data.findPendingIssuedSince(scope, startOfLocalDay(now));
    if (existing) return { challenge: existing, created: false };
  }

  const preferences = await deps.data.getPreferences(scope);
  if (!preferences) throw new FotoaiNotFoundError('User preferences not found');
  const gear = await deps.data.listGearNames(scope);
  const recentChallenges = await deps.data.listRecentChallengeTexts(scope, 5);

  const location = preferences.currentLocation || preferences.homeLocation || DEFAULT_LOCATION;
  const weather = await weatherFor(deps.services, location, deps.log);

  let generated: LlmChallenge;
  try {
    generated = await deps.services.ai.generateChallenge({
      userProfile: {
        name: opts.displayName || 'Photographer',
        skillLevel: preferences.skillLevel,
        interests: preferences.photographyInterests,
        gear,
      },
      challengeType,
      location,
      weather: weather
        ? {
          condition: weather.condition,
          temperature: weather.temperature,
          time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        }
        : undefined,
      recentChallenges,
    });
  } catch (err) {
    throw new FotoaiUpstreamError(0, `Challenge generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const row = challengeRowFromLlm(generated, {
    challengeType,
    location,
    weatherConditions: weather ? `${weather.condition}, ${weather.temperature}°F` : null,
    issuedAt: now,
  });
  const challenge = await deps.data.insertChallenge(scope, row);
  await deps.data.incrementIssued(scope, challengeType, now);
  await deps.data.logAgentAction(scope, 'CHALLENGE_SENT', {
    challengeId: challenge.id,
    challengeType: challenge.challenge_type,
    category: challenge.category,
  });
  return { challenge, created: true };
}

/** camelCase view of a challenge row, the shape the pages read. */
export function toChallengeDto(row: ChallengeRow) {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    id: row.id,
    challengeType: row.challenge_type,
    challengeText: row.challenge_text,
    category: row.category ?? 'General',
    difficulty: row.difficulty ?? 'Not set',
    duration: opt(row.duration) ?? '',
    tips: opt(row.tips) ?? '',
    recommendedGear: strings(row.recommended_gear),
    weatherConditions: opt(row.weather_conditions),
    location: opt(row.location),
    status: row.status,
    issuedDate: row.issued_date,
    completedDate: row.completed_date ?? null,
    shotList: strings(row.shot_list),
    narrativeContext: opt(row.narrative_context),
    editingDirection: opt(row.editing_direction),
    masteryArea: opt(row.mastery_area),
    technicalLevel: typeof row.technical_level === 'number' ? row.technical_level : undefined,
    successCriteria: opt(row.success_criteria),
    whatToLookFor: opt(row.what_to_look_for),
  };
}
