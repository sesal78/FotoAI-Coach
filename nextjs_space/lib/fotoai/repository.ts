// Owner-scoped data access for FotoAI tables.
//
// Every function takes an OwnerScope built from the verified principal. The
// scope's userId is written into every row and added as a filter to every
// query. The scope's access token is forwarded so Postgres RLS enforces the
// same rule a second time. Rows owned by someone else are reported as 404.

import { FotoaiNotFoundError, FotoaiValidationError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import { completedFieldForChallengeType, nextStreak } from './progress-rules.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

export interface OwnerScope {
  userId: string;
  accessToken: string;
}

export interface ChallengeRow {
  id: string;
  user_id: string;
  challenge_type: string;
  challenge_text: string;
  difficulty: string | null;
  category: string | null;
  status: 'pending' | 'accepted' | 'skipped' | 'completed';
  issued_date: string;
  completed_date: string | null;
  [key: string]: unknown;
}

export interface SubmissionRow {
  id: string;
  user_id: string;
  challenge_id: string;
  photo_object_key: string | null;
  photo_mime: string | null;
  photo_bytes: number | null;
  notes: string;
  feedback: string | null;
  rating: number | null;
  feedback_status: 'pending' | 'ready';
  submitted_at: string;
  [key: string]: unknown;
}

export interface ProgressRow {
  id: string;
  user_id: string;
  total_challenges_issued: number;
  total_challenges_completed: number;
  current_streak: number;
  longest_streak: number;
  last_completion_date: string | null;
  [key: string]: unknown;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';
export type GearCategory = 'camera' | 'lens' | 'tripod' | 'light' | 'other';

export interface PreferenceRow {
  id: string;
  user_id: string;
  skill_level: string;
  photography_interests: unknown;
  home_location: unknown;
  current_location: unknown;
  updated_at: string | null;
  [key: string]: unknown;
}

export interface PreferenceDto {
  skillLevel: SkillLevel;
  photographyInterests: string[];
  homeLocation: string | null;
  currentLocation: string | null;
}

/** Work days use the legacy short names; photo days use full names (legacy data shape). */
export type PreferenceWorkDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type PreferencePhotoDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/** Every browser-editable column of fotoai_user_preferences (GET/PUT ?view=full). */
export interface FullPreferenceDto extends PreferenceDto {
  avoidsStyles: string[];
  workDays: PreferenceWorkDay[];
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  primaryPhotoDay: PreferencePhotoDay;
  secondaryPhotoDays: PreferencePhotoDay[];
  lunchBreakPhotography: boolean;
  eveningPhotography: boolean;
  wfhFlexibility: boolean;
  adaptToWeather: boolean;
  adaptToCalendar: boolean;
  officeLocation: string | null;
}

export type PreferenceView = 'basic' | 'full';
export type PreferenceInput = Partial<FullPreferenceDto>;

export interface GearRow {
  id: string;
  user_id: string;
  category: string;
  brand: string;
  model: string;
  [key: string]: unknown;
}

export interface GearDto {
  id: string;
  category: GearCategory;
  brand: string;
  model: string;
}

export interface CreateGearInput {
  category: GearCategory;
  brand: string;
  model: string;
}

export interface CreateSubmissionInput {
  challengeId: string;
  notes?: string;
  rating?: number | null;
}

export type ChallengeStatusFilter = 'pending' | 'accepted' | 'skipped' | 'completed' | 'all';

const T_CHALLENGES = 'fotoai_daily_challenges';
const T_SUBMISSIONS = 'fotoai_challenge_submissions';
const T_PROGRESS = 'fotoai_user_progress';
const T_AGENT_ACTIONS = 'fotoai_agent_actions';
const T_PREFERENCES = 'fotoai_user_preferences';
const T_GEAR = 'fotoai_user_gear';

const SKILL_LEVELS = new Set<SkillLevel>(['beginner', 'intermediate', 'advanced', 'professional']);
const GEAR_CATEGORIES = new Set<GearCategory>(['camera', 'lens', 'tripod', 'light', 'other']);
const PREFERENCE_FIELDS = new Set(['skillLevel', 'photographyInterests', 'homeLocation', 'currentLocation']);
/** DTO field -> column. The first four are the basic view. */
const PREFERENCE_COLUMNS: Record<keyof FullPreferenceDto, string> = {
  skillLevel: 'skill_level',
  photographyInterests: 'photography_interests',
  homeLocation: 'home_location',
  currentLocation: 'current_location',
  avoidsStyles: 'avoids_styles',
  workDays: 'work_days',
  workStartTime: 'work_start_time',
  workEndTime: 'work_end_time',
  lunchStartTime: 'lunch_start_time',
  lunchEndTime: 'lunch_end_time',
  primaryPhotoDay: 'primary_photo_day',
  secondaryPhotoDays: 'secondary_photo_days',
  lunchBreakPhotography: 'lunch_break_photography',
  eveningPhotography: 'evening_photography',
  wfhFlexibility: 'wfh_flexibility',
  adaptToWeather: 'adapt_to_weather',
  adaptToCalendar: 'adapt_to_calendar',
  officeLocation: 'office_location',
};
const PREFERENCE_FULL_FIELDS = new Set(Object.keys(PREFERENCE_COLUMNS));
const PREFERENCE_WORK_DAYS: readonly PreferenceWorkDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PREFERENCE_PHOTO_DAYS: readonly PreferencePhotoDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PREFERENCE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PREFERENCE_TIME_FIELDS = ['workStartTime', 'workEndTime', 'lunchStartTime', 'lunchEndTime'] as const;
const PREFERENCE_BOOLEAN_FIELDS = ['lunchBreakPhotography', 'eveningPhotography', 'wfhFlexibility', 'adaptToWeather', 'adaptToCalendar'] as const;

/** Defaults for the schedule fields when no row exists (the legacy register seed). */
export const PREFERENCE_DEFAULTS: Omit<FullPreferenceDto, keyof PreferenceDto> = {
  avoidsStyles: [],
  workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  workStartTime: '09:00',
  workEndTime: '17:00',
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  primaryPhotoDay: 'Saturday',
  secondaryPhotoDays: ['Sunday'],
  lunchBreakPhotography: true,
  eveningPhotography: true,
  wfhFlexibility: true,
  adaptToWeather: true,
  adaptToCalendar: true,
  officeLocation: null,
};

/** The row the legacy register route seeded, minus user_id. Used once after sign-up confirmation. */
export const PREFERENCE_SEED_ROW: Record<string, unknown> = {
  skill_level: 'intermediate',
  photography_interests: ['street', 'portrait', 'architecture'],
  avoids_styles: PREFERENCE_DEFAULTS.avoidsStyles,
  work_days: PREFERENCE_DEFAULTS.workDays,
  work_start_time: PREFERENCE_DEFAULTS.workStartTime,
  work_end_time: PREFERENCE_DEFAULTS.workEndTime,
  lunch_start_time: PREFERENCE_DEFAULTS.lunchStartTime,
  lunch_end_time: PREFERENCE_DEFAULTS.lunchEndTime,
  primary_photo_day: PREFERENCE_DEFAULTS.primaryPhotoDay,
  secondary_photo_days: PREFERENCE_DEFAULTS.secondaryPhotoDays,
  lunch_break_photography: true,
  evening_photography: true,
  wfh_flexibility: true,
  adapt_to_weather: true,
  adapt_to_calendar: true,
};
const GEAR_FIELDS = new Set(['category', 'brand', 'model']);

function owner(scope: OwnerScope): Record<string, string> {
  return { user_id: `eq.${requireUuid(scope.userId, 'session user id')}` };
}

function clampLimit(limit: number | undefined, fallback: number, max: number): string {
  const n = Number.isFinite(limit) && (limit as number) > 0 ? Math.floor(limit as number) : fallback;
  return String(Math.min(n, max));
}

function assertOnlyFields(input: Record<string, unknown>, allowed: Set<string>): void {
  const unexpected = Object.keys(input).find((key) => !allowed.has(key));
  if (unexpected) throw new FotoaiValidationError(`Unexpected field: ${unexpected}`);
}

function cleanLocation(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new FotoaiValidationError(`${field} must be a string or null`);
  const cleaned = value.trim();
  if (cleaned.length > 120) throw new FotoaiValidationError(`${field} must be at most 120 characters`);
  return cleaned;
}

function cleanInterests(value: unknown, field = 'photographyInterests', label = 'photography interest'): string[] {
  if (!Array.isArray(value)) throw new FotoaiValidationError(`${field} must be an array`);
  if (value.length > 20) throw new FotoaiValidationError(`${field} must have at most 20 items`);
  const cleaned = value.map((item) => {
    if (typeof item !== 'string') throw new FotoaiValidationError(`Each ${label} must be a string`);
    const interest = item.trim();
    if (!interest || interest.length > 40) {
      throw new FotoaiValidationError(`Each ${label} must be 1 to 40 characters`);
    }
    return interest;
  });
  const unique = [...new Set(cleaned)];
  if (unique.length > 20) throw new FotoaiValidationError(`${field} must have at most 20 items`);
  return unique;
}

/** Index 0-6 (Mon-Sun) for a short or full English day name; -1 otherwise. */
function preferenceDayIndex(value: unknown): number {
  if (typeof value !== 'string') return -1;
  const short = PREFERENCE_WORK_DAYS.indexOf(value as PreferenceWorkDay);
  return short !== -1 ? short : PREFERENCE_PHOTO_DAYS.indexOf(value as PreferencePhotoDay);
}

function cleanDays<T extends string>(value: unknown, field: string, canonical: readonly T[]): T[] {
  if (!Array.isArray(value)) throw new FotoaiValidationError(`${field} must be an array`);
  if (value.length > 7) throw new FotoaiValidationError(`${field} must have at most 7 items`);
  const indexes = value.map((item) => {
    const index = preferenceDayIndex(item);
    if (index === -1) throw new FotoaiValidationError(`${field} contains an invalid day`);
    return index;
  });
  return [...new Set(indexes)].sort((a, b) => a - b).map((index) => canonical[index]);
}

function cleanTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !PREFERENCE_TIME.test(value)) {
    throw new FotoaiValidationError(`${field} must be a 24-hour HH:MM time`);
  }
  return value;
}

function parsePreferenceInput(input: Record<string, unknown>, view: PreferenceView = 'basic'): PreferenceInput {
  assertOnlyFields(input, view === 'full' ? PREFERENCE_FULL_FIELDS : PREFERENCE_FIELDS);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
  const parsed: PreferenceInput = {};
  if (has('avoidsStyles')) parsed.avoidsStyles = cleanInterests(input.avoidsStyles, 'avoidsStyles', 'avoided style');
  if (has('workDays')) parsed.workDays = cleanDays(input.workDays, 'workDays', PREFERENCE_WORK_DAYS);
  if (has('secondaryPhotoDays')) {
    parsed.secondaryPhotoDays = cleanDays(input.secondaryPhotoDays, 'secondaryPhotoDays', PREFERENCE_PHOTO_DAYS);
  }
  if (has('primaryPhotoDay')) {
    const index = preferenceDayIndex(input.primaryPhotoDay);
    if (index === -1) throw new FotoaiValidationError('primaryPhotoDay must be a day name');
    parsed.primaryPhotoDay = PREFERENCE_PHOTO_DAYS[index];
  }
  for (const field of PREFERENCE_TIME_FIELDS) {
    if (has(field)) parsed[field] = cleanTime(input[field], field);
  }
  for (const field of PREFERENCE_BOOLEAN_FIELDS) {
    if (!has(field)) continue;
    if (typeof input[field] !== 'boolean') throw new FotoaiValidationError(`${field} must be a boolean`);
    parsed[field] = input[field] as boolean;
  }
  if (has('officeLocation')) parsed.officeLocation = cleanLocation(input.officeLocation, 'officeLocation');
  if (Object.prototype.hasOwnProperty.call(input, 'skillLevel')) {
    if (typeof input.skillLevel !== 'string' || !SKILL_LEVELS.has(input.skillLevel as SkillLevel)) {
      throw new FotoaiValidationError('skillLevel is invalid');
    }
    parsed.skillLevel = input.skillLevel as SkillLevel;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'photographyInterests')) {
    parsed.photographyInterests = cleanInterests(input.photographyInterests);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'homeLocation')) {
    parsed.homeLocation = cleanLocation(input.homeLocation, 'homeLocation');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'currentLocation')) {
    parsed.currentLocation = cleanLocation(input.currentLocation, 'currentLocation');
  }
  return parsed;
}

function mapPreferences(row?: Partial<PreferenceRow>): PreferenceDto;
function mapPreferences(row: Partial<PreferenceRow> | undefined, view: 'full'): FullPreferenceDto;
function mapPreferences(row: Partial<PreferenceRow> | undefined, view: PreferenceView): PreferenceDto | FullPreferenceDto;
function mapPreferences(row?: Partial<PreferenceRow>, view: PreferenceView = 'basic'): PreferenceDto | FullPreferenceDto {
  const basic = mapBasicPreferences(row);
  if (view !== 'full') return basic;
  const d = PREFERENCE_DEFAULTS;
  const days = <T extends string>(value: unknown, canonical: readonly T[], fallback: T[]): T[] => {
    if (!Array.isArray(value)) return fallback;
    const indexes = value.map(preferenceDayIndex).filter((index) => index !== -1);
    return [...new Set(indexes)].sort((a, b) => a - b).map((index) => canonical[index]);
  };
  const time = (value: unknown, fallback: string) => typeof value === 'string' && PREFERENCE_TIME.test(value) ? value : fallback;
  const flag = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
  const styles = row?.avoids_styles;
  const primaryIndex = preferenceDayIndex(row?.primary_photo_day);
  const office = row?.office_location;
  return {
    ...basic,
    avoidsStyles: Array.isArray(styles)
      ? [...new Set(styles.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item.length > 0 && item.length <= 40))].slice(0, 20)
      : [...d.avoidsStyles],
    workDays: days(row?.work_days, PREFERENCE_WORK_DAYS, [...d.workDays]),
    workStartTime: time(row?.work_start_time, d.workStartTime),
    workEndTime: time(row?.work_end_time, d.workEndTime),
    lunchStartTime: time(row?.lunch_start_time, d.lunchStartTime),
    lunchEndTime: time(row?.lunch_end_time, d.lunchEndTime),
    primaryPhotoDay: primaryIndex === -1 ? d.primaryPhotoDay : PREFERENCE_PHOTO_DAYS[primaryIndex],
    secondaryPhotoDays: days(row?.secondary_photo_days, PREFERENCE_PHOTO_DAYS, [...d.secondaryPhotoDays]),
    lunchBreakPhotography: flag(row?.lunch_break_photography, d.lunchBreakPhotography),
    eveningPhotography: flag(row?.evening_photography, d.eveningPhotography),
    wfhFlexibility: flag(row?.wfh_flexibility, d.wfhFlexibility),
    adaptToWeather: flag(row?.adapt_to_weather, d.adaptToWeather),
    adaptToCalendar: flag(row?.adapt_to_calendar, d.adaptToCalendar),
    officeLocation: typeof office === 'string' && office.trim().length <= 120 ? office.trim() : null,
  };
}

function mapBasicPreferences(row?: Partial<PreferenceRow>): PreferenceDto {
  const skillLevel = typeof row?.skill_level === 'string' && SKILL_LEVELS.has(row.skill_level as SkillLevel)
    ? row.skill_level as SkillLevel
    : 'intermediate';
  const storedInterests = row?.photography_interests;
  const photographyInterests = Array.isArray(storedInterests)
    ? [...new Set(storedInterests.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item.length > 0 && item.length <= 40))].slice(0, 20)
    : [];
  const safeLocation = (value: unknown) => typeof value === 'string' && value.trim().length <= 120 ? value.trim() : null;
  return {
    skillLevel,
    photographyInterests,
    homeLocation: safeLocation(row?.home_location),
    currentLocation: safeLocation(row?.current_location),
  };
}

function cleanGearText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new FotoaiValidationError(`${field} must be a string`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 80) throw new FotoaiValidationError(`${field} must be 1 to 80 characters`);
  return cleaned;
}

function parseGearInput(input: Record<string, unknown>): CreateGearInput {
  assertOnlyFields(input, GEAR_FIELDS);
  if (typeof input.category !== 'string' || !GEAR_CATEGORIES.has(input.category as GearCategory)) {
    throw new FotoaiValidationError('category is invalid');
  }
  return {
    category: input.category as GearCategory,
    brand: cleanGearText(input.brand, 'brand'),
    model: cleanGearText(input.model, 'model'),
  };
}

function mapGear(row: GearRow): GearDto {
  const category = GEAR_CATEGORIES.has(row.category as GearCategory) ? row.category as GearCategory : 'other';
  return { id: row.id, category, brand: String(row.brand ?? ''), model: String(row.model ?? '') };
}

export function createFotoaiRepository(client: FotoaiSupabaseClient) {
  return {
    // ----- preferences -------------------------------------------------
    /** Basic view: the four original fields. Full view (?view=full): every editable column. */
    async getPreferences(scope: OwnerScope, view: PreferenceView = 'basic'): Promise<PreferenceDto | FullPreferenceDto> {
      const fields = view === 'full' ? Object.keys(PREFERENCE_COLUMNS) : [...PREFERENCE_FIELDS];
      const rows = await client.restSelect<PreferenceRow>(
        T_PREFERENCES,
        { ...owner(scope), select: fields.map((f) => PREFERENCE_COLUMNS[f as keyof FullPreferenceDto]).join(','), limit: '1' },
        scope.accessToken,
      );
      return mapPreferences(rows[0], view);
    },

    async savePreferences(scope: OwnerScope, input: Record<string, unknown>, view: PreferenceView = 'basic'): Promise<PreferenceDto | FullPreferenceDto> {
      const parsed = parsePreferenceInput(input, view);
      const row: Record<string, unknown> = {
        user_id: requireUuid(scope.userId, 'session user id'),
        updated_at: new Date().toISOString(),
      };
      for (const [field, column] of Object.entries(PREFERENCE_COLUMNS)) {
        const value = parsed[field as keyof FullPreferenceDto];
        if (value !== undefined) row[column] = value;
      }
      const saved = await client.restUpsert<PreferenceRow>(T_PREFERENCES, row, 'user_id', scope.accessToken);
      return mapPreferences(saved, view);
    },

    // ----- gear --------------------------------------------------------
    async listGear(scope: OwnerScope): Promise<GearDto[]> {
      const rows = await client.restSelect<GearRow>(
        T_GEAR,
        { ...owner(scope), select: 'id,category,brand,model', order: 'created_at.desc', limit: '100' },
        scope.accessToken,
      );
      return rows.map(mapGear);
    },

    async createGear(scope: OwnerScope, input: Record<string, unknown>): Promise<GearDto> {
      const parsed = parseGearInput(input);
      const row = await client.restInsert<GearRow>(T_GEAR, {
        user_id: requireUuid(scope.userId, 'session user id'),
        ...parsed,
      }, scope.accessToken);
      return mapGear(row);
    },

    async deleteGear(scope: OwnerScope, gearId: string): Promise<void> {
      const id = requireUuid(gearId, 'gear id');
      const rows = await client.restDelete<GearRow>(
        T_GEAR,
        { ...owner(scope), id: `eq.${id}` },
        scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Gear not found');
    },

    // ----- challenges ---------------------------------------------------
    async listChallenges(scope: OwnerScope, opts: { status?: ChallengeStatusFilter; limit?: number } = {}): Promise<ChallengeRow[]> {
      const query: Record<string, string> = {
        ...owner(scope),
        select: '*',
        order: 'issued_date.desc',
        limit: clampLimit(opts.limit, 10, 100),
      };
      if (opts.status && opts.status !== 'all') {
        if (!['pending', 'accepted', 'skipped', 'completed'].includes(opts.status)) {
          throw new FotoaiValidationError('Invalid status filter');
        }
        query.status = `eq.${opts.status}`;
      }
      return client.restSelect<ChallengeRow>(T_CHALLENGES, query, scope.accessToken);
    },

    async getChallenge(scope: OwnerScope, challengeId: string): Promise<ChallengeRow> {
      const id = requireUuid(challengeId, 'challengeId');
      const rows = await client.restSelect<ChallengeRow>(
        T_CHALLENGES, { ...owner(scope), id: `eq.${id}`, select: '*', limit: '1' }, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Challenge not found');
      return rows[0];
    },

    async updateChallengeStatus(scope: OwnerScope, challengeId: string, status: ChallengeRow['status']): Promise<ChallengeRow> {
      const id = requireUuid(challengeId, 'challengeId');
      if (!['pending', 'accepted', 'skipped', 'completed'].includes(status)) {
        throw new FotoaiValidationError('Invalid status');
      }
      const patch: Record<string, unknown> = { status };
      if (status === 'completed') patch.completed_date = new Date().toISOString();
      const rows = await client.restUpdate<ChallengeRow>(
        T_CHALLENGES, { ...owner(scope), id: `eq.${id}` }, patch, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Challenge not found');
      return rows[0];
    },

    // ----- submissions --------------------------------------------------
    async listSubmissions(scope: OwnerScope, opts: { challengeId?: string; limit?: number } = {}): Promise<SubmissionRow[]> {
      const query: Record<string, string> = {
        ...owner(scope),
        select: '*',
        order: 'submitted_at.desc',
        limit: clampLimit(opts.limit, 50, 200),
      };
      if (opts.challengeId) query.challenge_id = `eq.${requireUuid(opts.challengeId, 'challengeId')}`;
      return client.restSelect<SubmissionRow>(T_SUBMISSIONS, query, scope.accessToken);
    },

    async getSubmission(scope: OwnerScope, submissionId: string): Promise<SubmissionRow> {
      const id = requireUuid(submissionId, 'submissionId');
      const rows = await client.restSelect<SubmissionRow>(
        T_SUBMISSIONS, { ...owner(scope), id: `eq.${id}`, select: '*', limit: '1' }, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Submission not found');
      return rows[0];
    },

    /** Creates a submission for one of the caller's own challenges. */
    async createSubmission(scope: OwnerScope, input: CreateSubmissionInput): Promise<SubmissionRow> {
      // Owner check on the parent first (404 when it is not ours).
      const challenge = await this.getChallenge(scope, input.challengeId);
      const notes = typeof input.notes === 'string' ? input.notes.slice(0, 2000) : '';
      const rating = input.rating == null ? null : Number(input.rating);
      if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        throw new FotoaiValidationError('rating must be an integer from 1 to 5');
      }
      const row: Record<string, unknown> = {
        user_id: scope.userId, // from the session, never from input
        challenge_id: challenge.id,
        notes,
        feedback_status: 'pending',
        submitted_at: new Date().toISOString(),
      };
      if (rating !== null) row.rating = rating;
      return client.restInsert<SubmissionRow>(T_SUBMISSIONS, row, scope.accessToken);
    },

    async updateSubmission(scope: OwnerScope, submissionId: string, patch: Partial<Pick<SubmissionRow, 'photo_object_key' | 'photo_mime' | 'photo_bytes' | 'feedback' | 'feedback_status'>>): Promise<SubmissionRow> {
      const id = requireUuid(submissionId, 'submissionId');
      const rows = await client.restUpdate<SubmissionRow>(
        T_SUBMISSIONS, { ...owner(scope), id: `eq.${id}` }, patch, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Submission not found');
      return rows[0];
    },

    /** Deletes the caller's submission and returns the removed row (for object cleanup). */
    async deleteSubmission(scope: OwnerScope, submissionId: string): Promise<SubmissionRow> {
      const id = requireUuid(submissionId, 'submissionId');
      const rows = await client.restDelete<SubmissionRow>(
        T_SUBMISSIONS, { ...owner(scope), id: `eq.${id}` }, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Submission not found');
      return rows[0];
    },

    // ----- progress -----------------------------------------------------
    async getOrCreateProgress(scope: OwnerScope): Promise<ProgressRow> {
      const rows = await client.restSelect<ProgressRow>(
        T_PROGRESS, { ...owner(scope), select: '*', limit: '1' }, scope.accessToken,
      );
      if (rows.length === 1) return rows[0];
      return client.restInsert<ProgressRow>(T_PROGRESS, { user_id: scope.userId }, scope.accessToken);
    },

    /** Applies the completion of `challenge` to the caller's progress row. */
    async recordCompletion(scope: OwnerScope, challenge: ChallengeRow, now: Date = new Date()): Promise<ProgressRow> {
      const progress = await this.getOrCreateProgress(scope);
      const streak = nextStreak(progress.last_completion_date, progress.current_streak, now);
      const patch: Record<string, unknown> = {
        total_challenges_completed: (progress.total_challenges_completed || 0) + 1,
        current_streak: streak,
        longest_streak: Math.max(progress.longest_streak || 0, streak),
        last_completion_date: now.toISOString(),
        last_streak_update: now.toISOString(),
        updated_at: now.toISOString(),
      };
      const typeField = completedFieldForChallengeType(challenge.challenge_type);
      if (typeField) patch[typeField] = ((progress[typeField] as number) || 0) + 1;
      const rows = await client.restUpdate<ProgressRow>(
        T_PROGRESS, { ...owner(scope), id: `eq.${progress.id}` }, patch, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Progress row not found');
      return rows[0];
    },

    // ----- audit --------------------------------------------------------
    async logAgentAction(scope: OwnerScope, actionType: string, details: Record<string, unknown>, success = true): Promise<void> {
      await client.restInsert(T_AGENT_ACTIONS, {
        user_id: scope.userId,
        action_type: actionType,
        details,
        success,
        executed_at: new Date().toISOString(),
      }, scope.accessToken);
    },
  };
}

export type FotoaiRepository = ReturnType<typeof createFotoaiRepository>;
