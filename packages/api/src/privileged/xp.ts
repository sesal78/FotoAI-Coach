// Privileged XP awards for plan steps and challenges (service role: fotoai_award_skill_xp is not
// granted to users). A plan step earns XP_AMOUNTS.PLAN_STEP split over the foundational skills, once: the
// award function's (user, skill, source kind, source id) key turns a repeat into 'duplicate'.
// Callers must have proven the step is the caller's and that a photo or frame is linked to it.

import { FOUNDATIONAL_SKILLS, getSkillById, getSkillsForCategory, getXPForChallenge, XP_AMOUNTS } from '@fotoai/core';
import { createServiceClient } from '@fotoai/db/service';
import type { ServerEnv } from '@fotoai/env';

import { ApiError } from '../handler.ts';

export type XpOutcome = 'applied' | 'duplicate' | 'locked';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function awardPlanStepXp(
  env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_SERVICE_ROLE_KEY'>,
  userId: string,
  stepId: string,
): Promise<XpOutcome[]> {
  if (!UUID.test(userId) || !UUID.test(stepId)) throw new ApiError('validation', 'XP needs a user and a step id');
  const per = Math.max(1, Math.ceil(XP_AMOUNTS.PLAN_STEP / FOUNDATIONAL_SKILLS.length));
  return awardEach(env, userId, FOUNDATIONAL_SKILLS, per, 'plan_step', stepId);
}

/**
 * The live app's challenge award: the challenge's XP split over its category's skills, kind
 * 'challenge_complete', once per challenge. Callers must have proven the challenge is the caller's.
 */
export async function awardChallengeXp(
  env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_SERVICE_ROLE_KEY'>,
  userId: string,
  challenge: { id: string; challenge_type: string; difficulty: string | null; category: string | null },
): Promise<XpOutcome[]> {
  if (!UUID.test(userId) || !UUID.test(challenge.id)) throw new ApiError('validation', 'XP needs a user and a challenge id');
  const skills = getSkillsForCategory(challenge.category ?? '');
  if (skills.length === 0) return [];
  const per = Math.max(1, Math.ceil(getXPForChallenge(challenge.challenge_type, challenge.difficulty ?? '') / skills.length));
  return awardEach(env, userId, skills, per, 'challenge_complete', challenge.id);
}

// One at a time: a later skill's prerequisites may depend on an earlier award.
async function awardEach(
  env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_SERVICE_ROLE_KEY'>,
  userId: string,
  skillIds: readonly string[],
  per: number,
  kind: 'plan_step' | 'challenge_complete',
  sourceId: string,
): Promise<XpOutcome[]> {
  const service = createServiceClient(env);
  const outcomes: XpOutcome[] = [];
  for (const skillId of skillIds) {
    const skill = getSkillById(skillId);
    if (!skill) continue;
    const { data, error } = await service.rpc('fotoai_award_skill_xp', {
      p_user_id: userId,
      p_skill_id: skill.id,
      p_xp_amount: per,
      p_source_kind: kind,
      p_source_id: sourceId,
      p_xp_to_learn: skill.xpToLearn,
      p_xp_to_practice: skill.xpToPractice,
      p_xp_to_master: skill.xpToMaster,
      p_prerequisite_skills: skill.prerequisites,
    });
    if (error) throw new ApiError('upstream', 'Could not award XP');
    outcomes.push((data as { outcome: XpOutcome }).outcome);
  }
  return outcomes;
}
