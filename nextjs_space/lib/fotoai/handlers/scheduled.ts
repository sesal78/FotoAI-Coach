// Scheduled (cron) jobs, ported from app/api/scheduled/*/route.ts (Appwrite).
//
//   GET|POST /api/fotoai/scheduled/daily-challenge
//   GET|POST /api/fotoai/scheduled/streak-manager
//   GET|POST /api/fotoai/scheduled/weather-monitor
//   GET|POST /api/fotoai/scheduled/weekly-report
//
// Auth: `Authorization: Bearer <CRON_SECRET>` (cron-auth.ts) is checked before
// anything else; no secret on the server -> 500, bad header -> 401. The body
// is never read, so a GET (or a POST) with no body works. There is no
// per-request targeting: each job pages through every auth user itself.
//
// Each user runs inside its own try/catch, so one failure is recorded as
// {userId, status: 'error', error} and the loop goes on. Users the legacy job
// skipped silently (no preferences / no progress row) are omitted from
// `results`, as before. Emails never appear in responses or logs.
//
// All data access goes through cron-data-access.ts (service role bound to one
// user: every read filters user_id, every write filters id AND user_id).

import {
  generateChallengeFor,
  toChallengeDto,
  type GeneratableChallengeType,
} from '../challenge-generation.ts';
import { assertCronRequest, type CronSecretSource } from '../cron-auth.ts';
import {
  bindServiceToUser,
  createCronGenerationDataAccess,
  listAllUsers,
  type CronScope,
} from '../cron-data-access.ts';
import { FotoaiUpstreamError } from '../errors.ts';
import type { VerifiedUser } from '../membership.ts';
import type { GenerationPreferences } from '../repo-generation.ts';
import { type DepsProvider, type FotoaiDeps, defaultLog, errorResponse, json } from './shared.ts';

const T_PROGRESS = 'fotoai_user_progress';
const T_PREFERENCES = 'fotoai_user_preferences';
const T_CHALLENGES = 'fotoai_daily_challenges';
const T_SUBMISSIONS = 'fotoai_challenge_submissions';
const T_CRITIQUES = 'fotoai_photo_critiques';
const T_WEEKLY = 'fotoai_weekly_reports';

const DAY_MS = 1000 * 60 * 60 * 24;
/** Newest rows read per user per table for the weekly window (two weeks). */
export const WEEKLY_ROW_LIMIT = 500;
export const WEATHER_ALERT_MIN_SCORE = 80;

type Row = Record<string, unknown>;

/** A job's outcome for one user. */
export interface JobOutcome {
  status: string;
  error?: string;
  [key: string]: unknown;
}

export type UserResult = { userId: string } & JobOutcome;

/** null = skipped silently (legacy `continue`). */
type UserJob = (deps: FotoaiDeps, user: VerifiedUser, now: Date) => Promise<JobOutcome | null>;

export interface ScheduledOptions {
  /** Where CRON_SECRET comes from. Default: process.env, read per request. */
  cronSecret?: CronSecretSource;
  /** Clock for the whole run. Default: new Date(). */
  now?: () => Date;
  /** Logger used before deps are resolved (e.g. missing CRON_SECRET). */
  log?: FotoaiDeps['log'];
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 300) : 'Unknown error';
}

function cronRoute(provider: DepsProvider, opts: ScheduledOptions, name: string, message: string, job: UserJob) {
  return async (request: Request): Promise<Response> => {
    let deps: FotoaiDeps | undefined;
    try {
      assertCronRequest(request, opts.cronSecret);
      deps = provider();
      const now = opts.now?.() ?? new Date();
      const users = await listAllUsers(deps.client);
      const results: UserResult[] = [];
      for (const user of users) {
        try {
          const outcome = await job(deps, user, now);
          if (outcome) results.push({ userId: user.id, ...outcome });
        } catch (err) {
          deps.log?.('error', `${name} failed for user ${user.id}: ${messageOf(err)}`);
          results.push({ userId: user.id, status: 'error', error: messageOf(err) });
        }
      }
      return json({ message, results });
    } catch (err) {
      return errorResponse(err, deps ?? { log: opts.log ?? defaultLog });
    }
  };
}

/** Sends one email to the user's own auth address. Never throws; false on failure. */
async function sendSafely(
  deps: FotoaiDeps,
  label: string,
  user: VerifiedUser,
  send: (email: string, name: string) => Promise<boolean>,
): Promise<boolean> {
  if (!user.email) return false;
  try {
    return (await send(user.email, user.name || 'Photographer')) === true;
  } catch (err) {
    deps.log?.('warn', `${label} failed for user ${user.id}: ${messageOf(err)}`);
    return false;
  }
}

function startOfLocalDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function time(value: unknown): number {
  const t = typeof value === 'string' ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? NaN : t;
}

function noAngles(value: string): string {
  return value.replace(/[<>]/g, '').trim();
}

// ---------------------------------------------------------------------------
// daily-challenge
// ---------------------------------------------------------------------------

/**
 * Legacy determineChallengeType, on the server's local clock. The legacy
 * LUNCH_MICRO / WORK_FROM_HOME names are not generator types (lib/llm.ts
 * knows LUNCH_BREAK / WFH_MICRO); progress counters treat them as the same.
 */
export function determineChallengeType(preferences: GenerationPreferences, now: Date): GeneratableChallengeType {
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  if (dayOfWeek === 6) return 'WEEKEND_DEEP_DIVE';
  if (dayOfWeek === 0 && preferences.secondaryPhotoDays.includes('Sunday')) return 'WEEKEND_DEEP_DIVE';
  if (hour >= 11 && hour < 13 && preferences.lunchBreakPhotography) return 'LUNCH_BREAK';
  if (hour >= 17 && hour < 19 && preferences.eveningPhotography) return 'AFTER_WORK';
  if (preferences.wfhFlexibility) return 'WFH_MICRO';
  return 'LUNCH_BREAK';
}

const dailyChallengeJob: UserJob = async (deps, user, now) => {
  const scope: CronScope = { userId: user.id };
  const data = createCronGenerationDataAccess(deps.client);
  const preferences = await data.getPreferences(scope);
  if (!preferences) return null;

  // generateChallengeFor keeps the legacy rule: a pending challenge issued
  // since local midnight means "skip", not a second challenge.
  const result = await generateChallengeFor(
    { data, services: deps.services, now: () => now, log: deps.log },
    scope,
    { challengeType: determineChallengeType(preferences, now), displayName: user.name },
  );
  if (!result.created) {
    return { status: 'skipped', reason: 'Challenge already exists for today', challengeId: result.challenge.id };
  }

  const dto = toChallengeDto(result.challenge);
  const emailSent = await sendSafely(deps, 'Challenge email', user, (email, name) =>
    deps.services.mail.sendChallengeEmail(email, name, {
      challengeText: noAngles(dto.challengeText),
      difficulty: noAngles(dto.difficulty),
      category: noAngles(dto.category),
      duration: noAngles(dto.duration),
      tips: noAngles(dto.tips),
      recommendedGear: dto.recommendedGear.map(noAngles),
    }));
  return { status: 'success', challengeId: result.challenge.id, emailSent };
};

// ---------------------------------------------------------------------------
// streak-manager
// ---------------------------------------------------------------------------

const streakManagerJob: UserJob = async (deps, user, now) => {
  const svc = bindServiceToUser(deps.client, user.id);
  const [progress] = await svc.select<Row>(T_PROGRESS, {
    select: 'id,current_streak,last_completion_date', limit: '1',
  });
  if (!progress) return null;
  const last = time(progress.last_completion_date);
  if (Number.isNaN(last)) return null; // no completion yet: streak stays 0

  // Legacy window: whole days from the last completion to local midnight today.
  const daysSinceCompletion = Math.floor((startOfLocalDay(now).getTime() - last) / DAY_MS);
  const currentStreak = typeof progress.current_streak === 'number' ? progress.current_streak : 0;
  if (daysSinceCompletion <= 1) return { status: 'streak_maintained', currentStreak };
  // Legacy re-reset and re-logged lapsed users every night; a streak already at 0 is left alone.
  if (currentStreak === 0) return { status: 'streak_already_reset', daysSinceCompletion };

  await svc.updateById(T_PROGRESS, String(progress.id), {
    current_streak: 0,
    last_streak_update: now.toISOString(),
    updated_at: now.toISOString(),
  });
  await svc.logAction('STREAK_RESET', { previousStreak: currentStreak, daysSinceCompletion });
  return { status: 'streak_reset', previousStreak: currentStreak };
};

// ---------------------------------------------------------------------------
// weather-monitor
// ---------------------------------------------------------------------------

function trimmed(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
}

const weatherMonitorJob: UserJob = async (deps, user) => {
  const svc = bindServiceToUser(deps.client, user.id);
  const [prefs] = await svc.select<Row>(T_PREFERENCES, {
    select: 'adapt_to_weather,current_location,home_location', limit: '1',
  });
  if (!prefs || prefs.adapt_to_weather !== true) return null;
  // Only users with a saved location (legacy fell back to San Francisco).
  const location = trimmed(prefs.current_location) ?? trimmed(prefs.home_location);
  if (!location) return null;

  const weather = await deps.services.weather.getWeather(location);
  if (!weather) return null;
  const analysis = deps.services.weather.analyzeWeatherForPhotography(weather);
  if (analysis.score < WEATHER_ALERT_MIN_SCORE) return { status: 'no_alert', score: analysis.score };

  const alert = {
    condition: weather.condition,
    message: `${weather.condition} conditions with ${weather.temperature}°F - ${analysis.recommendation}`,
    suggestion: `Great time for ${analysis.suggestedStyles.slice(0, 3).join(', ')} photography!`,
  };
  const emailSent = await sendSafely(deps, 'Weather alert', user, (email, name) =>
    deps.services.mail.sendWeatherAlert(email, name, alert));
  await svc.logAction('WEATHER_ALERT', {
    location,
    weather: { condition: weather.condition, temperature: weather.temperature },
    score: analysis.score,
    emailSent,
  });
  return { status: 'alert_sent', score: analysis.score, emailSent };
};

// ---------------------------------------------------------------------------
// weekly-report
// ---------------------------------------------------------------------------

function avg(values: unknown[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function inRange(value: unknown, from: number, to: number): boolean {
  const t = time(value);
  return !Number.isNaN(t) && t >= from && t < to;
}

const weeklyReportJob: UserJob = async (deps, user, now) => {
  const svc = bindServiceToUser(deps.client, user.id);
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const weekStart = oneWeekAgo.toISOString().split('T')[0];
  const weekEnd = now.toISOString().split('T')[0];

  // fotoai_weekly_reports is unique (user_id, week_start): never a second row.
  const [existing] = await svc.select<Row>(T_WEEKLY, { week_start: `eq.${weekStart}`, select: 'id', limit: '1' });
  if (existing) return { status: 'skipped', reason: 'Report already exists for this week', reportId: existing.id };

  const limit = String(WEEKLY_ROW_LIMIT);
  const [progressRows, challenges, submissions, critiques, prefsRows] = await Promise.all([
    svc.select<Row>(T_PROGRESS, { select: 'current_streak,longest_streak', limit: '1' }),
    svc.select<Row>(T_CHALLENGES, { select: 'status,category,issued_date', order: 'issued_date.desc', limit }),
    svc.select<Row>(T_SUBMISSIONS, { select: 'submitted_at', order: 'submitted_at.desc', limit }),
    svc.select<Row>(T_CRITIQUES, {
      select: 'overall_score,technical_score,composition_score,creative_score,critique_date',
      order: 'critique_date.desc', limit,
    }),
    svc.select<Row>(T_PREFERENCES, { select: 'skill_level', limit: '1' }),
  ]);

  const openEnd = Number.POSITIVE_INFINITY; // "this week" has no upper bound, as in legacy
  const weekMs = oneWeekAgo.getTime();
  const twoWeekMs = twoWeeksAgo.getTime();
  const thisWeekChallenges = challenges.filter((c) => inRange(c.issued_date, weekMs, openEnd));
  const lastWeekChallenges = challenges.filter((c) => inRange(c.issued_date, twoWeekMs, weekMs));
  const thisWeekCritiques = critiques.filter((c) => inRange(c.critique_date, weekMs, openEnd));
  const lastWeekCritiques = critiques.filter((c) => inRange(c.critique_date, twoWeekMs, weekMs));
  const submissionsThisWeek = submissions.filter((s) => inRange(s.submitted_at, weekMs, openEnd)).length;

  const completedThisWeek = thisWeekChallenges.filter((c) => c.status === 'completed');
  const completedLastWeek = lastWeekChallenges.filter((c) => c.status === 'completed');

  const categoryCount: Record<string, number> = {};
  for (const c of completedThisWeek) {
    if (typeof c.category === 'string' && c.category) categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
  }
  const topCategories = Object.entries(categoryCount).sort(([, a], [, b]) => b - a).slice(0, 3).map(([cat]) => cat);
  const completionRate = thisWeekChallenges.length > 0
    ? Math.round((completedThisWeek.length / thisWeekChallenges.length) * 100)
    : 0;
  const progress = progressRows[0];
  const skillLevel = typeof prefsRows[0]?.skill_level === 'string' ? prefsRows[0].skill_level : 'intermediate';

  const stats = {
    weekStart,
    weekEnd,
    challengesCompletedThisWeek: completedThisWeek.length,
    challengesCompletedLastWeek: completedLastWeek.length,
    submissionsThisWeek,
    averageCritiqueScore: avg(thisWeekCritiques.map((c) => c.overall_score)),
    previousAverageCritiqueScore: avg(lastWeekCritiques.map((c) => c.overall_score)),
    scoreTrend: {
      technical: avg(thisWeekCritiques.map((c) => c.technical_score)),
      composition: avg(thisWeekCritiques.map((c) => c.composition_score)),
      creative: avg(thisWeekCritiques.map((c) => c.creative_score)),
    },
    previousScoreTrend: {
      technical: avg(lastWeekCritiques.map((c) => c.technical_score)),
      composition: avg(lastWeekCritiques.map((c) => c.composition_score)),
      creative: avg(lastWeekCritiques.map((c) => c.creative_score)),
    },
    topCategories,
    challengeCompletionRate: completionRate,
    currentStreak: typeof progress?.current_streak === 'number' ? progress.current_streak : 0,
    longestStreak: typeof progress?.longest_streak === 'number' ? progress.longest_streak : 0,
  };

  let insights: Awaited<ReturnType<FotoaiDeps['services']['ai']['generateWeeklyInsights']>>;
  try {
    insights = await deps.services.ai.generateWeeklyInsights({ userName: user.name || 'Photographer', skillLevel, stats });
  } catch (err) {
    throw new FotoaiUpstreamError(0, `Weekly insights generation failed: ${messageOf(err)}`);
  }

  let report: Row;
  try {
    report = await svc.insert<Row>(T_WEEKLY, {
      week_start: weekStart,
      week_end: weekEnd,
      stats,
      insights,
      report_date: now.toISOString(),
    });
  } catch (err) {
    // A concurrent run won the unique (user_id, week_start) race.
    if (err instanceof FotoaiUpstreamError && err.upstreamStatus === 409) {
      return { status: 'skipped', reason: 'Report already exists for this week' };
    }
    throw err;
  }

  const emailSent = await sendSafely(deps, 'Weekly report email', user, (email, name) =>
    deps.services.mail.sendWeeklyReport(email, name, {
      challengesCompleted: completedThisWeek.length,
      challengesCompletedLastWeek: completedLastWeek.length,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      averageScore: stats.averageCritiqueScore,
      previousAverageScore: stats.previousAverageCritiqueScore,
      completionRate,
      favoriteSubjects: topCategories,
      insights,
    }));
  await svc.logAction('WEEKLY_INSIGHTS_REPORT', {
    reportId: report.id,
    challengesCompleted: completedThisWeek.length,
    averageScore: stats.averageCritiqueScore,
    emailSent,
  });
  return { status: 'success', reportId: report.id, challengesCompleted: completedThisWeek.length, emailSent };
};

// ---------------------------------------------------------------------------

export function createScheduledHandlers(provider: DepsProvider, opts: ScheduledOptions = {}) {
  return {
    dailyChallenge: cronRoute(provider, opts, 'Daily challenge', 'Daily challenge generation completed', dailyChallengeJob),
    streakManager: cronRoute(provider, opts, 'Streak manager', 'Streak management completed', streakManagerJob),
    weatherMonitor: cronRoute(provider, opts, 'Weather monitor', 'Weather monitoring completed', weatherMonitorJob),
    weeklyReport: cronRoute(provider, opts, 'Weekly report', 'Weekly insights report generation completed', weeklyReportJob),
  };
}
