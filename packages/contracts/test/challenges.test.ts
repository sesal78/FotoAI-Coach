import { expect, test } from 'vitest';

import { CHALLENGE_SOURCES, CHALLENGE_STATUSES, ChallengeDto } from '../src/index.ts';

const dto = {
  id: '11111111-2222-4333-8444-555555555555',
  challengeType: 'AFTER_WORK',
  challengeText: 'Leading lines at blue hour',
  category: 'street',
  difficulty: 'medium',
  duration: '1 hour',
  tips: '',
  recommendedGear: ['X-T5'],
  status: 'pending',
  issuedDate: '2026-10-18T05:00:00+00:00',
  completedDate: null,
  shotList: [],
  source: 'dashboard',
};

test('statuses and sources match the database checks', () => {
  expect(CHALLENGE_STATUSES).toEqual(['pending', 'accepted', 'skipped', 'completed', 'superseded']);
  expect(CHALLENGE_SOURCES).toEqual(['dashboard', 'chat', 'plan', 'job']);
});

test('ChallengeDto accepts a full challenge and rejects an unknown status or source', () => {
  expect(ChallengeDto.parse({ ...dto, technicalLevel: 3, location: 'Fitzroy' })).toMatchObject({ technicalLevel: 3 });
  expect(() => ChallengeDto.parse({ ...dto, status: 'archived' })).toThrow();
  expect(() => ChallengeDto.parse({ ...dto, source: 'web' })).toThrow();
});
