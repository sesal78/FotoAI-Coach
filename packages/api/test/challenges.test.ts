import { expect, test } from 'vitest';

import { decodeCursor, encodeCursor, parseListQuery, toV2Challenge } from '../src/index.ts';

test('cursors round-trip and a bad cursor is a validation error', () => {
  const cursor = encodeCursor('2026-10-18T05:00:00+00:00', '11111111-2222-4333-8444-555555555555');
  expect(decodeCursor(cursor)).toEqual({ issuedDate: '2026-10-18T05:00:00+00:00', id: '11111111-2222-4333-8444-555555555555' });
  for (const bad of ['%%%', encodeCursor('not-a-date', 'x'), Buffer.from('nopipe').toString('base64url')]) {
    expect(() => decodeCursor(bad), bad).toThrow(expect.objectContaining({ code: 'validation' }));
  }
});

test('list query defaults and bounds', () => {
  expect(parseListQuery(new URLSearchParams())).toEqual({ status: 'all', limit: 20, cursor: null });
  expect(parseListQuery(new URLSearchParams('status=accepted&limit=50'))).toMatchObject({ status: 'accepted', limit: 50 });
  for (const q of ['status=bogus', 'limit=0', 'limit=51', 'limit=abc']) {
    expect(() => parseListQuery(new URLSearchParams(q)), q).toThrow(expect.objectContaining({ code: 'validation' }));
  }
});

test('toV2Challenge maps a database row to the shared DTO with safe defaults', () => {
  const row = {
    id: '11111111-2222-4333-8444-555555555555', user_id: 'u', legacy_appwrite_id: null, challenge_type: 'CHATBOT_GENERATED',
    challenge_text: 'Frame strangers', difficulty: null, category: null, duration: null, weather_conditions: null,
    location: null, recommended_gear: null, tips: null, issued_date: '2026-10-18T05:00:00+00:00', status: 'pending',
    completed_date: null, shot_list: null, narrative_context: null, editing_direction: null, mastery_area: null,
    technical_level: null, success_criteria: null, what_to_look_for: null, created_at: '2026-10-18T05:00:00+00:00', source: 'chat',
  };
  expect(toV2Challenge(row as never)).toEqual({
    id: row.id, challengeType: 'CHATBOT_GENERATED', challengeText: 'Frame strangers', category: 'General', difficulty: 'Not set',
    duration: '', tips: '', recommendedGear: [], status: 'pending', issuedDate: row.issued_date, completedDate: null,
    shotList: [], source: 'chat',
  });
});
