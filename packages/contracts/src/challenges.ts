// Challenge shapes shared by the API, web and mobile. Field names match the live app's
// toChallengeDto (nextjs_space/lib/fotoai/challenge-generation.ts) plus `source` (refactor 2B).

import { z } from 'zod';

export const CHALLENGE_STATUSES = ['pending', 'accepted', 'skipped', 'completed', 'superseded'] as const;
export const CHALLENGE_SOURCES = ['dashboard', 'chat', 'plan', 'job'] as const;

export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];
export type ChallengeSource = (typeof CHALLENGE_SOURCES)[number];

export const ChallengeDto = z.object({
  id: z.string().uuid(),
  challengeType: z.string(),
  challengeText: z.string(),
  category: z.string(),
  difficulty: z.string(),
  duration: z.string(),
  tips: z.string(),
  recommendedGear: z.array(z.string()),
  weatherConditions: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(CHALLENGE_STATUSES),
  issuedDate: z.string(),
  completedDate: z.string().nullable(),
  shotList: z.array(z.string()),
  narrativeContext: z.string().optional(),
  editingDirection: z.string().optional(),
  masteryArea: z.string().optional(),
  technicalLevel: z.number().int().optional(),
  successCriteria: z.string().optional(),
  whatToLookFor: z.string().optional(),
  source: z.enum(CHALLENGE_SOURCES),
});

export type ChallengeDto = z.infer<typeof ChallengeDto>;

export const ChallengeListResponse = z.object({
  challenges: z.array(ChallengeDto),
  nextCursor: z.string().nullable(),
});

export type ChallengeListResponse = z.infer<typeof ChallengeListResponse>;
