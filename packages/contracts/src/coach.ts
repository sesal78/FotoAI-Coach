// The in-app coach: one message with the screen it was sent from, the reply with at most one
// proposal, and the stored history.

import { z } from 'zod';

import { ChallengeDto } from './challenges.ts';

const inId = z.string().uuid().transform((s) => s.toLowerCase());

export const COACH_SCREENS = ['today', 'explore', 'shoot', 'photos', 'me'] as const;

export const CoachInput = z
  .object({
    message: z.string().trim().min(1).max(2000),
    context: z.object({ screen: z.enum(COACH_SCREENS), planId: inId.optional(), rollId: inId.optional() }).strict(),
  })
  .strict();

export type CoachInput = z.infer<typeof CoachInput>;

export const CoachProposal = z.union([
  z.object({ kind: z.literal('challenge'), challenge: ChallengeDto }),
  z.object({ kind: z.literal('plan'), placeId: z.string(), date: z.string().nullable() }),
  z.object({ kind: z.literal('plan'), spotId: z.string().uuid(), date: z.string().nullable() }),
]);

export type CoachProposal = z.infer<typeof CoachProposal>;

export const CoachReply = z.object({ reply: z.string(), proposal: CoachProposal.nullable() });

export type CoachReply = z.infer<typeof CoachReply>;

export const CoachMessageDto = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  proposal: CoachProposal.nullable(),
  createdAt: z.string(),
});

export type CoachMessageDto = z.infer<typeof CoachMessageDto>;
