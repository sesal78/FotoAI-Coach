/**
 * Server-side XP award utilities.
 * Handles awarding XP to user skills, creating XP events, and updating skill status.
 */

import { Query, ID, type Databases } from 'node-appwrite';
import { DATABASE_ID, COLLECTION_USER_SKILLS, COLLECTION_XP_EVENTS } from '@/lib/appwrite-collections';
import {
  SKILL_TREE,
  getSkillById,
  getStatusForXP,
  arePrerequisitesMet,
  getSkillsForCategory,
  getXPForChallenge,
  getXPForCritiqueScores,
  XP_AMOUNTS,
  type UserSkillState,
} from '@/lib/skills';

interface AwardResult {
  skillId: string;
  xpAwarded: number;
  newXP: number;
  newStatus: string;
  leveledUp: boolean;
}

/**
 * Load all skill states for a user from the database.
 */
async function loadUserSkills(databases: Databases, userId: string): Promise<Map<string, { docId: string; state: UserSkillState }>> {
  const map = new Map<string, { docId: string; state: UserSkillState }>();
  let offset = 0;
  const limit = 100;

  while (true) {
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_USER_SKILLS, [
      Query.equal('userId', userId),
      Query.limit(limit),
      Query.offset(offset),
    ]);

    for (const doc of result.documents) {
      map.set(doc.skillId as string, {
        docId: doc.$id,
        state: {
          skillId: doc.skillId as string,
          currentXP: (doc.currentXP as number) || 0,
          status: (doc.status as UserSkillState['status']) || 'available',
        },
      });
    }

    if (result.documents.length < limit) break;
    offset += limit;
  }

  return map;
}

/**
 * Award XP to a specific skill for a user.
 * Creates the skill doc if it doesn't exist and the skill is unlockable.
 * Returns null if skill is locked (prerequisites not met).
 */
async function awardXPToSkill(
  databases: Databases,
  userId: string,
  skillId: string,
  xpAmount: number,
  source: string,
  sourceId: string | undefined,
  userSkills: Map<string, { docId: string; state: UserSkillState }>,
): Promise<AwardResult | null> {
  const skill = getSkillById(skillId);
  if (!skill) return null;

  // Build a status map for prerequisite checking
  const statusMap = new Map<string, UserSkillState>();
  for (const [id, entry] of userSkills) {
    statusMap.set(id, entry.state);
  }

  // Check if prerequisites are met
  if (!arePrerequisitesMet(skillId, statusMap)) {
    return null; // Skill is locked
  }

  const existing = userSkills.get(skillId);
  const previousXP = existing?.state.currentXP ?? 0;
  const previousStatus = existing?.state.status ?? 'available';
  const newXP = previousXP + xpAmount;
  const newStatus = getStatusForXP(newXP, skill);
  const leveledUp = newStatus !== previousStatus;

  const now = new Date().toISOString();

  if (existing) {
    // Update existing skill doc
    await databases.updateDocument(DATABASE_ID, COLLECTION_USER_SKILLS, existing.docId, {
      currentXP: newXP,
      status: newStatus,
      lastXPDate: now,
    });
    // Update the in-memory map
    existing.state.currentXP = newXP;
    existing.state.status = newStatus;
  } else {
    // Create new skill doc
    const doc = await databases.createDocument(DATABASE_ID, COLLECTION_USER_SKILLS, ID.unique(), {
      userId,
      skillId,
      currentXP: newXP,
      status: newStatus,
      lastXPDate: now,
    });
    userSkills.set(skillId, {
      docId: doc.$id,
      state: { skillId, currentXP: newXP, status: newStatus },
    });
  }

  // Record XP event
  const eventData: Record<string, unknown> = {
    userId,
    skillId,
    xpAmount,
    source,
    awardedAt: now,
  };
  if (sourceId) eventData.sourceId = sourceId;

  await databases.createDocument(DATABASE_ID, COLLECTION_XP_EVENTS, ID.unique(), eventData);

  return { skillId, xpAwarded: xpAmount, newXP, newStatus, leveledUp };
}

/**
 * Award XP for a challenge completion.
 * Distributes XP across skills related to the challenge category.
 */
export async function awardChallengeXP(
  databases: Databases,
  userId: string,
  challengeType: string,
  difficulty: string,
  category: string,
  challengeId: string,
): Promise<AwardResult[]> {
  const xpAmount = getXPForChallenge(challengeType, difficulty);
  const relatedSkills = getSkillsForCategory(category);

  if (relatedSkills.length === 0) return [];

  // Distribute XP evenly across related skills (rounded up)
  const perSkillXP = Math.max(1, Math.ceil(xpAmount / relatedSkills.length));

  const userSkills = await loadUserSkills(databases, userId);
  const results: AwardResult[] = [];

  for (const skillId of relatedSkills) {
    const result = await awardXPToSkill(
      databases, userId, skillId, perSkillXP,
      'challenge_complete', challengeId, userSkills,
    );
    if (result) results.push(result);
  }

  return results;
}

/**
 * Award XP for critique scores above threshold.
 * Maps score dimensions to skill categories.
 */
export async function awardCritiqueXP(
  databases: Databases,
  userId: string,
  scores: { technical: number; composition: number; creative: number },
  critiqueId: string,
): Promise<AwardResult[]> {
  const { total, breakdown } = getXPForCritiqueScores(scores);
  if (total === 0) return [];

  const userSkills = await loadUserSkills(databases, userId);
  const results: AwardResult[] = [];

  // Map critique dimensions to skill categories
  const dimensionToCategory: Record<string, string[]> = {
    technical: ['exposure_triangle', 'iso_management', 'depth_of_field', 'white_balance'],
    composition: ['rule_of_thirds', 'leading_lines', 'framing', 'symmetry'],
    creative: ['raw_editing', 'color_grading', 'exposure_correction'],
  };

  for (const [dimension, xp] of Object.entries(breakdown)) {
    const skillIds = dimensionToCategory[dimension] ?? [];
    if (skillIds.length === 0) continue;

    const perSkillXP = Math.max(1, Math.ceil(xp / skillIds.length));

    for (const skillId of skillIds) {
      const result = await awardXPToSkill(
        databases, userId, skillId, perSkillXP,
        'critique_bonus', critiqueId, userSkills,
      );
      if (result) results.push(result);
    }
  }

  return results;
}

/**
 * Award submission XP — flat amount to foundational skills.
 */
export async function awardSubmissionXP(
  databases: Databases,
  userId: string,
  submissionId: string,
): Promise<AwardResult[]> {
  const foundationalSkills = ['exposure_triangle', 'rule_of_thirds', 'raw_editing'];
  const perSkillXP = Math.max(1, Math.ceil(XP_AMOUNTS.SUBMISSION / foundationalSkills.length));

  const userSkills = await loadUserSkills(databases, userId);
  const results: AwardResult[] = [];

  for (const skillId of foundationalSkills) {
    const result = await awardXPToSkill(
      databases, userId, skillId, perSkillXP,
      'submission', submissionId, userSkills,
    );
    if (result) results.push(result);
  }

  return results;
}

/**
 * Get the full skill tree state for a user (used by the API route).
 */
export async function getUserSkillTree(databases: Databases, userId: string) {
  const userSkills = await loadUserSkills(databases, userId);

  // Build status map for prerequisite checking
  const statusMap = new Map<string, UserSkillState>();
  for (const [id, entry] of userSkills) {
    statusMap.set(id, entry.state);
  }

  let totalXP = 0;

  const skills = SKILL_TREE.map((skill) => {
    const userState = userSkills.get(skill.id);
    const currentXP = userState?.state.currentXP ?? 0;
    totalXP += currentXP;

    let status: string;
    if (userState) {
      status = userState.state.status;
    } else if (arePrerequisitesMet(skill.id, statusMap)) {
      status = 'available';
    } else {
      status = 'locked';
    }

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

  const { getLevelFromXP } = await import('@/lib/skills');
  const levelInfo = getLevelFromXP(totalXP);

  return {
    skills,
    totalXP,
    level: levelInfo.level,
    levelProgress: levelInfo.progress,
    xpForNextLevel: levelInfo.xpForNextLevel,
  };
}
