// Pure progress rules ported from app/api/submissions/route.ts (Appwrite path).

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
