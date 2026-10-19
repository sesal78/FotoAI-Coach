import { describe, expect, test } from 'vitest';

import { canMove, CHALLENGE_MOVES, completedFieldForChallengeType, nextStreak, progressAfterCompletion } from '../src/index.ts';

describe('challenge moves', () => {
  test('the move table allows only forward moves', () => {
    expect(CHALLENGE_MOVES).toEqual({
      pending: ['accepted', 'skipped', 'completed'],
      accepted: ['skipped', 'completed'],
      skipped: [],
      completed: [],
      superseded: [],
    });
    expect(canMove('pending', 'accepted')).toBe(true);
    expect(canMove('accepted', 'completed')).toBe(true);
    expect(canMove('accepted', 'pending')).toBe(false);
    expect(canMove('completed', 'pending')).toBe(false);
    expect(canMove('skipped', 'completed')).toBe(false);
    expect(canMove('superseded', 'accepted')).toBe(false);
    expect(canMove('unknown', 'accepted')).toBe(false);
  });
});

describe('nextStreak keeps its live behaviour', () => {
  const now = new Date('2026-10-19T09:00:00Z');
  test.each([
    [null, 4, 1],
    [undefined, 4, 1],
    ['not a date', 4, 1],
    ['2026-10-18T08:00:00Z', 4, 5], // one day ago: grows
    ['2026-10-19T07:00:00Z', 4, 4], // same day: kept
    ['2026-10-19T07:00:00Z', 0, 1], // same day, no streak yet: 1
    ['2026-10-16T09:00:00Z', 4, 1], // a gap: reset
  ])('last=%s streak=%s gives %s', (last, streak, expected) => {
    expect(nextStreak(last, streak, now)).toBe(expected);
  });
});

describe('progressAfterCompletion', () => {
  const now = new Date('2026-10-19T09:00:00Z');
  const progress = {
    total_challenges_completed: 7,
    current_streak: 2,
    longest_streak: 2,
    last_completion_date: '2026-10-18T09:00:00Z',
    after_work_completed: 3,
    wfh_completed: 1,
  };

  test("counts the type's own counter", () => {
    expect(progressAfterCompletion(progress, 'AFTER_WORK', now)).toEqual({
      total_challenges_completed: 8,
      current_streak: 3,
      longest_streak: 3,
      last_completion_date: now.toISOString(),
      last_streak_update: now.toISOString(),
      updated_at: now.toISOString(),
      after_work_completed: 4,
    });
    expect(progressAfterCompletion(progress, 'WFH_MICRO', now)).toMatchObject({ wfh_completed: 2 });
    expect(completedFieldForChallengeType('LUNCH_MICRO')).toBe('lunch_break_completed');
  });

  test('a type with no counter only moves the totals and streak', () => {
    const patch = progressAfterCompletion(progress, 'CHATBOT_GENERATED', now);
    expect(Object.keys(patch).sort()).toEqual(
      ['current_streak', 'last_completion_date', 'last_streak_update', 'longest_streak', 'total_challenges_completed', 'updated_at'],
    );
  });
});
