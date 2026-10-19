// Challenge status moves and the progress rules for a completion. nextStreak and the counter map
// moved here unchanged from nextjs_space/lib/fotoai/progress-rules.ts (which re-exports them).

export type ChallengeState = 'pending' | 'accepted' | 'skipped' | 'completed' | 'superseded';

/** Forward moves only: skipped, completed and superseded are final. */
export const CHALLENGE_MOVES: Readonly<Record<ChallengeState, readonly ChallengeState[]>> = {
  pending: ['accepted', 'skipped', 'completed'],
  accepted: ['skipped', 'completed'],
  skipped: [],
  completed: [],
  superseded: [],
};

export function canMove(from: string, to: string): boolean {
  const moves = (CHALLENGE_MOVES as Record<string, readonly string[] | undefined>)[from];
  return Boolean(moves?.includes(to));
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** Next streak value after a completion at `now`, given the previous completion. */
export function nextStreak(lastCompletionDate: string | null | undefined, currentStreak: number, now: Date = new Date()): number {
  if (!lastCompletionDate) return 1;
  const last = new Date(lastCompletionDate);
  if (Number.isNaN(last.getTime())) return 1;
  const daysDiff = Math.floor((now.getTime() - last.getTime()) / DAY_MS);
  if (daysDiff === 1) return (currentStreak || 0) + 1;
  if (daysDiff === 0) return currentStreak || 1;
  return 1;
}

const COMPLETED_FIELD_BY_TYPE: Record<string, string> = {
  WEEKEND_DEEP_DIVE: 'saturday_challenges_completed',
  LUNCH_MICRO: 'lunch_break_completed',
  LUNCH_BREAK: 'lunch_break_completed',
  AFTER_WORK: 'after_work_completed',
  WORK_FROM_HOME: 'wfh_completed',
  WFH_MICRO: 'wfh_completed',
};

export function completedFieldForChallengeType(challengeType: string): string | null {
  return COMPLETED_FIELD_BY_TYPE[challengeType] ?? null;
}

export interface ProgressCounts {
  total_challenges_completed?: number | null;
  current_streak?: number | null;
  longest_streak?: number | null;
  last_completion_date?: string | null;
  [counter: string]: unknown;
}

/** The progress patch for one completion: the same fields the live recordCompletion writes. */
export function progressAfterCompletion(progress: ProgressCounts, challengeType: string, now: Date): Record<string, unknown> {
  const streak = nextStreak(progress.last_completion_date, progress.current_streak ?? 0, now);
  const patch: Record<string, unknown> = {
    total_challenges_completed: (progress.total_challenges_completed || 0) + 1,
    current_streak: streak,
    longest_streak: Math.max(progress.longest_streak || 0, streak),
    last_completion_date: now.toISOString(),
    last_streak_update: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const typeField = completedFieldForChallengeType(challengeType);
  if (typeField) patch[typeField] = ((progress[typeField] as number) || 0) + 1;
  return patch;
}
