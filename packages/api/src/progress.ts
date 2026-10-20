// GET /api/v2/me/progress: the caller's XP, level, streak and skill tree, read with the user's
// token. Same tree and status rules as the live skills page; a user with no rows reads as zeros
// (a GET writes nothing).

import type { ProgressResponse, SkillDto } from '@fotoai/contracts';
import { arePrerequisitesMet, getLevelFromXP, SKILL_TREE, type SkillStatus, type UserSkillState } from '@fotoai/core';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal } from './auth.ts';
import { ApiError, json, type V2Body } from './handler.ts';

export const getProgress: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const client = createUserClient(deps.env, principal.accessToken);
  const [skills, progress] = await Promise.all([
    client.from('fotoai_user_skills').select('skill_id, current_xp, status').eq('user_id', principal.userId).limit(1000),
    client.from('fotoai_user_progress').select('total_challenges_completed, total_challenges_issued, current_streak, longest_streak, last_completion_date').maybeSingle(),
  ]);
  if (skills.error || progress.error) throw new ApiError('upstream', 'Could not load your progress');

  const states = new Map<string, UserSkillState>(
    skills.data.map((r) => [r.skill_id, { skillId: r.skill_id, currentXP: r.current_xp || 0, status: (r.status || 'available') as SkillStatus }]),
  );
  let total = 0;
  const tree: SkillDto[] = SKILL_TREE.map((skill) => {
    const state = states.get(skill.id);
    const currentXP = state?.currentXP ?? 0;
    total += currentXP;
    return {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      description: skill.description,
      prerequisites: skill.prerequisites,
      tier: skill.tier,
      icon: skill.icon,
      xpToLearn: skill.xpToLearn,
      xpToPractice: skill.xpToPractice,
      xpToMaster: skill.xpToMaster,
      currentXP,
      status: state ? state.status : arePrerequisitesMet(skill.id, states) ? 'available' : 'locked',
    };
  });

  const level = getLevelFromXP(total);
  const p = progress.data;
  const body: ProgressResponse = {
    xp: { total, level: level.level, levelStart: level.xpForCurrentLevel, nextLevelAt: level.xpForNextLevel, progress: level.progress },
    streak: { current: p?.current_streak ?? 0, longest: p?.longest_streak ?? 0, lastCompletionDate: p?.last_completion_date ?? null },
    challenges: { completed: p?.total_challenges_completed ?? 0, issued: p?.total_challenges_issued ?? 0 },
    skills: tree,
  };
  return json(body);
};
