// Skill XP for FotoAI (Supabase port of lib/xp.ts).
//
// Awards go through the SQL function fotoai_award_skill_xp with the service
// role (browser roles may only read fotoai_user_skills / fotoai_xp_events).
// The function checks prerequisites, de-duplicates by (user, skill, kind,
// source) and updates the skill row atomically. The user id passed in is
// always the session principal's; callers have already loaded the source row
// (challenge, submission, critique) through the owner-scoped repository.

import {
  SKILL_TREE,
  XP_AMOUNTS,
  arePrerequisitesMet,
  getLevelFromXP,
  getSkillById,
  getSkillsForCategory,
  getXPForChallenge,
  getXPForCritiqueScores,
  type SkillStatus,
  type UserSkillState,
} from '../skills.ts';
import { requireUuid } from './object-keys.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

export type XpSourceKind = 'challenge_complete' | 'submission' | 'critique_bonus';

export interface XpAwardResult {
  skillId: string;
  xpAwarded: number;
  newXP: number;
  newStatus: string;
  leveledUp: boolean;
}

interface AwardRow {
  outcome: 'applied' | 'duplicate' | 'locked';
  skill_id: string;
  xp_awarded: number;
  current_xp: number;
  status: string;
  leveled_up: boolean;
}

const CRITIQUE_DIMENSION_SKILLS: Record<string, string[]> = {
  technical: ['exposure_triangle', 'iso_management', 'depth_of_field', 'white_balance'],
  composition: ['rule_of_thirds', 'leading_lines', 'framing', 'symmetry'],
  creative: ['raw_editing', 'color_grading', 'exposure_correction'],
};
const FOUNDATIONAL_SKILLS = ['exposure_triangle', 'rule_of_thirds', 'raw_editing'];

export function createXpService(client: FotoaiSupabaseClient) {
  async function award(scope: OwnerScope, skillId: string, xpAmount: number, kind: XpSourceKind, sourceId: string): Promise<XpAwardResult | null> {
    const skill = getSkillById(skillId);
    if (!skill) return null;
    const result = await client.serviceRpc<AwardRow>('fotoai_award_skill_xp', {
      p_user_id: requireUuid(scope.userId, 'session user id'),
      p_skill_id: skillId,
      p_xp_amount: xpAmount,
      p_source_kind: kind,
      p_source_id: requireUuid(sourceId, 'xp source id'),
      p_xp_to_learn: skill.xpToLearn,
      p_xp_to_practice: skill.xpToPractice,
      p_xp_to_master: skill.xpToMaster,
      p_prerequisite_skills: skill.prerequisites,
    });
    if (!result || result.outcome !== 'applied') return null;
    return {
      skillId,
      xpAwarded: result.xp_awarded,
      newXP: result.current_xp,
      newStatus: result.status,
      leveledUp: result.leveled_up,
    };
  }

  async function awardMany(scope: OwnerScope, skillIds: string[], perSkillXP: number, kind: XpSourceKind, sourceId: string): Promise<XpAwardResult[]> {
    const results: XpAwardResult[] = [];
    // One at a time: a later skill's prerequisites may depend on an earlier award.
    for (const skillId of skillIds) {
      const r = await award(scope, skillId, perSkillXP, kind, sourceId);
      if (r) results.push(r);
    }
    return results;
  }

  return {
    async awardChallengeXP(scope: OwnerScope, challenge: { id: string; challenge_type: string; difficulty?: string | null; category?: string | null }): Promise<XpAwardResult[]> {
      const xpAmount = getXPForChallenge(challenge.challenge_type, challenge.difficulty ?? '');
      const skills = getSkillsForCategory(challenge.category ?? '');
      if (skills.length === 0) return [];
      return awardMany(scope, skills, Math.max(1, Math.ceil(xpAmount / skills.length)), 'challenge_complete', challenge.id);
    },

    async awardSubmissionXP(scope: OwnerScope, submissionId: string): Promise<XpAwardResult[]> {
      const per = Math.max(1, Math.ceil(XP_AMOUNTS.SUBMISSION / FOUNDATIONAL_SKILLS.length));
      return awardMany(scope, FOUNDATIONAL_SKILLS, per, 'submission', submissionId);
    },

    async awardCritiqueXP(scope: OwnerScope, scores: { technical: number; composition: number; creative: number }, critiqueId: string): Promise<XpAwardResult[]> {
      const { total, breakdown } = getXPForCritiqueScores(scores);
      if (total === 0) return [];
      const results: XpAwardResult[] = [];
      for (const [dimension, xp] of Object.entries(breakdown)) {
        const skills = CRITIQUE_DIMENSION_SKILLS[dimension] ?? [];
        if (skills.length === 0) continue;
        results.push(...await awardMany(scope, skills, Math.max(1, Math.ceil(xp / skills.length)), 'critique_bonus', critiqueId));
      }
      return results;
    },

    /** Same response shape as the legacy /api/skills route. */
    async getSkillTree(scope: OwnerScope) {
      const rows = await client.restSelect<{ skill_id: string; current_xp: number; status: SkillStatus }>(
        'fotoai_user_skills',
        { user_id: `eq.${requireUuid(scope.userId, 'session user id')}`, select: 'skill_id,current_xp,status', limit: '1000' },
        scope.accessToken,
      );
      const states = new Map<string, UserSkillState>(
        rows.map((r) => [r.skill_id, { skillId: r.skill_id, currentXP: r.current_xp || 0, status: r.status || 'available' }]),
      );
      let totalXP = 0;
      const skills = SKILL_TREE.map((skill) => {
        const state = states.get(skill.id);
        const currentXP = state?.currentXP ?? 0;
        totalXP += currentXP;
        const status = state ? state.status : arePrerequisitesMet(skill.id, states) ? 'available' : 'locked';
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
          status,
        };
      });
      const level = getLevelFromXP(totalXP);
      return { skills, totalXP, level: level.level, levelProgress: level.progress, xpForNextLevel: level.xpForNextLevel };
    },
  };
}

export type FotoaiXpService = ReturnType<typeof createXpService>;
