// The skill catalog and XP amounts live in @fotoai/core (refactor 2E-2a); this keeps the live
// app's imports working.
export {
  arePrerequisitesMet,
  FOUNDATIONAL_SKILLS,
  getLevelFromXP,
  getNextThreshold,
  getSkillById,
  getSkillsByCategory,
  getSkillsForCategory,
  getStatusForXP,
  getXPForChallenge,
  getXPForCritiqueScores,
  SKILL_TREE,
  XP_AMOUNTS,
  type SkillCategory,
  type SkillStatus,
  type SkillNode,
  type UserSkillState,
  type XPAwardResult,
} from '@fotoai/core';
