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

/** PATCH /api/v2/challenges/:id. Moves go forward only (see CHALLENGE_MOVES in @fotoai/core). */
export const ChallengeStatusPatch = z.object({ status: z.enum(['accepted', 'skipped', 'completed']) }).strict();

export type ChallengeStatusPatch = z.infer<typeof ChallengeStatusPatch>;

/** GET /api/v2/challenges/active. */
export const ActiveChallengeResponse = z.object({ challenge: ChallengeDto.nullable() });

export type ActiveChallengeResponse = z.infer<typeof ActiveChallengeResponse>;

/** The types Today can ask for: the live generator's six. */
export const CHALLENGE_TYPES = ['WEEKEND_DEEP_DIVE', 'LUNCH_BREAK', 'AFTER_WORK', 'WFH_MICRO', 'STORY_DRIVEN', 'TECHNICAL_MASTERY'] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

/** POST /api/v2/challenges. With no type, a weekend deep dive (the live default). */
export const GenerateChallengeInput = z.object({ type: z.enum(CHALLENGE_TYPES).optional(), force: z.boolean().optional() }).strict();

export type GenerateChallengeInput = z.infer<typeof GenerateChallengeInput>;

/** 201 with created: true for a new challenge; 200 with created: false for today's open one. */
export const GenerateChallengeResponse = z.object({ challenge: ChallengeDto, created: z.boolean() });

export type GenerateChallengeResponse = z.infer<typeof GenerateChallengeResponse>;
