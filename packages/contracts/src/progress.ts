// GET /api/v2/me/progress: XP, level, streak, challenge counts and the skill tree for Me.
// SkillDto is the live /api/fotoai/skills item.

import { z } from 'zod';

export const SKILL_STATUSES = ['locked', 'available', 'learned', 'practiced', 'mastered'] as const;

export const SkillDto = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  prerequisites: z.array(z.string()),
  tier: z.number().int(),
  icon: z.string(),
  xpToLearn: z.number().int(),
  xpToPractice: z.number().int(),
  xpToMaster: z.number().int(),
  currentXP: z.number().int(),
  status: z.enum(SKILL_STATUSES),
});

export type SkillDto = z.infer<typeof SkillDto>;

export const ProgressResponse = z.object({
  xp: z.object({
    total: z.number().int(),
    level: z.number().int(),
    levelStart: z.number().int(),
    nextLevelAt: z.number().int(),
    progress: z.number().int(),
  }),
  streak: z.object({ current: z.number().int(), longest: z.number().int(), lastCompletionDate: z.string().nullable() }),
  challenges: z.object({ completed: z.number().int(), issued: z.number().int() }),
  skills: z.array(SkillDto),
});

export type ProgressResponse = z.infer<typeof ProgressResponse>;
