// Skill Tree definitions and XP calculation utilities. Shared by the live app (which re-exports
// this from nextjs_space/lib/skills.ts) and the v2 API (refactor 2E-2a).

export type SkillCategory = 'technical' | 'composition' | 'post_processing';
export type SkillStatus = 'locked' | 'available' | 'learned' | 'practiced' | 'mastered';

export interface SkillNode {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  prerequisites: string[];
  xpToLearn: number;
  xpToPractice: number;
  xpToMaster: number;
  tier: 1 | 2 | 3;
  icon: string; // Lucide icon name
  relatedChallengeCategories: string[];
}

export interface UserSkillState {
  skillId: string;
  currentXP: number;
  status: SkillStatus;
}

export interface XPAwardResult {
  skillId: string;
  xpAwarded: number;
  previousXP: number;
  newXP: number;
  previousStatus: SkillStatus;
  newStatus: SkillStatus;
  leveledUp: boolean;
}

// ── Skill Tree Data ─────────────────────────────────────────────────────────

export const SKILL_TREE: SkillNode[] = [
  // ── Technical Skills (15 nodes) ──────────────────────────────────────────
  {
    id: 'exposure_triangle',
    name: 'Exposure Triangle',
    category: 'technical',
    description: 'Understanding the relationship between ISO, aperture, and shutter speed',
    prerequisites: [],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Triangle',
    relatedChallengeCategories: ['street', 'portrait', 'landscape', 'nature'],
  },
  {
    id: 'iso_management',
    name: 'ISO Management',
    category: 'technical',
    description: 'Balancing sensitivity and noise for clean images in any lighting',
    prerequisites: ['exposure_triangle'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Gauge',
    relatedChallengeCategories: ['street', 'night', 'indoor', 'concert'],
  },
  {
    id: 'depth_of_field',
    name: 'Depth of Field',
    category: 'technical',
    description: 'Controlling what is sharp and what is blurred using aperture and distance',
    prerequisites: ['exposure_triangle'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Layers',
    relatedChallengeCategories: ['portrait', 'macro', 'nature', 'food'],
  },
  {
    id: 'white_balance',
    name: 'White Balance',
    category: 'technical',
    description: 'Managing color temperature for accurate or creative color rendering',
    prerequisites: ['exposure_triangle'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Thermometer',
    relatedChallengeCategories: ['portrait', 'food', 'product', 'indoor'],
  },
  {
    id: 'manual_focus',
    name: 'Manual Focus',
    category: 'technical',
    description: 'Precise focus control for critical sharpness and creative effects',
    prerequisites: ['depth_of_field'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Crosshair',
    relatedChallengeCategories: ['macro', 'portrait', 'landscape', 'astro'],
  },
  {
    id: 'metering_modes',
    name: 'Metering Modes',
    category: 'technical',
    description: 'Using evaluative, spot, and center-weighted metering for accurate exposure',
    prerequisites: ['exposure_triangle'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'CircleDot',
    relatedChallengeCategories: ['portrait', 'concert', 'street', 'wildlife'],
  },
  {
    id: 'long_exposure',
    name: 'Long Exposure',
    category: 'technical',
    description: 'Using slow shutter speeds for motion blur, light trails, and smooth water',
    prerequisites: ['exposure_triangle'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Timer',
    relatedChallengeCategories: ['landscape', 'night', 'abstract', 'architecture'],
  },
  {
    id: 'flash_basics',
    name: 'Flash Basics',
    category: 'technical',
    description: 'On-camera and bounce flash techniques for controlled lighting',
    prerequisites: ['exposure_triangle', 'white_balance'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Zap',
    relatedChallengeCategories: ['portrait', 'event', 'indoor', 'product'],
  },
  {
    id: 'back_button_focus',
    name: 'Back-Button Focus',
    category: 'technical',
    description: 'Separating focus from the shutter button for faster, more precise shooting',
    prerequisites: ['manual_focus'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'SquareAsterisk',
    relatedChallengeCategories: ['sports', 'wildlife', 'street', 'event'],
  },
  {
    id: 'bracketing',
    name: 'Bracketing',
    category: 'technical',
    description: 'Capturing multiple exposures for HDR or exposure insurance',
    prerequisites: ['metering_modes'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'CopyMinus',
    relatedChallengeCategories: ['landscape', 'architecture', 'real_estate'],
  },
  {
    id: 'hdr',
    name: 'HDR Imaging',
    category: 'technical',
    description: 'Merging multiple exposures for high dynamic range scenes',
    prerequisites: ['bracketing'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'SunMoon',
    relatedChallengeCategories: ['landscape', 'architecture', 'real_estate'],
  },
  {
    id: 'panning',
    name: 'Panning',
    category: 'technical',
    description: 'Tracking moving subjects to create sharp subject with blurred background',
    prerequisites: ['long_exposure'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'MoveHorizontal',
    relatedChallengeCategories: ['sports', 'street', 'automotive'],
  },
  {
    id: 'high_speed_sync',
    name: 'High-Speed Sync',
    category: 'technical',
    description: 'Using flash at fast shutter speeds to overpower ambient light',
    prerequisites: ['flash_basics'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'ZapOff',
    relatedChallengeCategories: ['portrait', 'fashion', 'outdoor'],
  },
  {
    id: 'focus_stacking',
    name: 'Focus Stacking',
    category: 'technical',
    description: 'Combining multiple focus planes for extreme depth of field',
    prerequisites: ['manual_focus', 'bracketing'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'Combine',
    relatedChallengeCategories: ['macro', 'product', 'landscape'],
  },
  {
    id: 'tethered_shooting',
    name: 'Tethered Shooting',
    category: 'technical',
    description: 'Shooting directly to a computer for instant review and precise control',
    prerequisites: ['exposure_triangle'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'Cable',
    relatedChallengeCategories: ['product', 'studio', 'fashion'],
  },

  // ── Composition Skills (12 nodes) ────────────────────────────────────────
  {
    id: 'rule_of_thirds',
    name: 'Rule of Thirds',
    category: 'composition',
    description: 'Placing subjects at intersection points for balanced, engaging images',
    prerequisites: [],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Grid3x3',
    relatedChallengeCategories: ['street', 'portrait', 'landscape', 'nature'],
  },
  {
    id: 'leading_lines',
    name: 'Leading Lines',
    category: 'composition',
    description: 'Using lines to guide the viewer\'s eye through the frame',
    prerequisites: ['rule_of_thirds'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'ArrowUpRight',
    relatedChallengeCategories: ['architecture', 'landscape', 'street', 'urban'],
  },
  {
    id: 'framing',
    name: 'Framing',
    category: 'composition',
    description: 'Using natural frames (doorways, branches, arches) to draw attention to the subject',
    prerequisites: ['rule_of_thirds'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Frame',
    relatedChallengeCategories: ['architecture', 'portrait', 'travel', 'street'],
  },
  {
    id: 'symmetry',
    name: 'Symmetry & Patterns',
    category: 'composition',
    description: 'Exploiting symmetrical elements and repeating patterns for visual impact',
    prerequisites: ['rule_of_thirds'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'FlipHorizontal',
    relatedChallengeCategories: ['architecture', 'abstract', 'urban', 'nature'],
  },
  {
    id: 'negative_space',
    name: 'Negative Space',
    category: 'composition',
    description: 'Using empty areas to create breathing room and emphasize the subject',
    prerequisites: ['rule_of_thirds'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Square',
    relatedChallengeCategories: ['minimalist', 'portrait', 'nature', 'abstract'],
  },
  {
    id: 'foreground_interest',
    name: 'Foreground Interest',
    category: 'composition',
    description: 'Adding depth by including compelling foreground elements',
    prerequisites: ['leading_lines'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Layers',
    relatedChallengeCategories: ['landscape', 'travel', 'nature'],
  },
  {
    id: 'depth_layering',
    name: 'Depth & Layering',
    category: 'composition',
    description: 'Creating visual depth through foreground, middle ground, and background layers',
    prerequisites: ['foreground_interest'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'LayoutList',
    relatedChallengeCategories: ['landscape', 'street', 'travel', 'documentary'],
  },
  {
    id: 'golden_ratio',
    name: 'Golden Ratio',
    category: 'composition',
    description: 'Applying the golden spiral and ratio for naturally pleasing compositions',
    prerequisites: ['rule_of_thirds'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Shell',
    relatedChallengeCategories: ['portrait', 'nature', 'architecture', 'fine_art'],
  },
  {
    id: 'diagonal_composition',
    name: 'Diagonal Composition',
    category: 'composition',
    description: 'Using diagonal lines and tilted elements for dynamic, energetic images',
    prerequisites: ['leading_lines'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'TrendingUp',
    relatedChallengeCategories: ['action', 'street', 'sports', 'architecture'],
  },
  {
    id: 'minimalism',
    name: 'Minimalism',
    category: 'composition',
    description: 'Stripping away distractions to create simple, powerful images',
    prerequisites: ['negative_space'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'Minus',
    relatedChallengeCategories: ['abstract', 'architecture', 'fine_art', 'nature'],
  },
  {
    id: 'pattern_repetition',
    name: 'Pattern & Repetition',
    category: 'composition',
    description: 'Identifying and breaking repeating patterns for visual rhythm',
    prerequisites: ['symmetry'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'Repeat',
    relatedChallengeCategories: ['architecture', 'abstract', 'urban', 'macro'],
  },
  {
    id: 'breaking_rules',
    name: 'Breaking Rules',
    category: 'composition',
    description: 'Intentionally defying composition rules for creative impact',
    prerequisites: ['rule_of_thirds', 'negative_space', 'golden_ratio'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'Slash',
    relatedChallengeCategories: ['abstract', 'fine_art', 'experimental', 'street'],
  },

  // ── Post-Processing Skills (8 nodes) ─────────────────────────────────────
  {
    id: 'raw_editing',
    name: 'RAW Editing Basics',
    category: 'post_processing',
    description: 'Understanding RAW files and basic development workflow',
    prerequisites: [],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'FileImage',
    relatedChallengeCategories: ['portrait', 'landscape', 'street', 'nature'],
  },
  {
    id: 'exposure_correction',
    name: 'Exposure Correction',
    category: 'post_processing',
    description: 'Recovering highlights, lifting shadows, and balancing tonal range',
    prerequisites: ['raw_editing'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Sun',
    relatedChallengeCategories: ['landscape', 'portrait', 'architecture', 'night'],
  },
  {
    id: 'cropping_straightening',
    name: 'Cropping & Straightening',
    category: 'post_processing',
    description: 'Refining composition in post through crop, rotation, and aspect ratio',
    prerequisites: ['raw_editing'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 1, icon: 'Crop',
    relatedChallengeCategories: ['street', 'portrait', 'architecture', 'landscape'],
  },
  {
    id: 'color_grading',
    name: 'Color Grading',
    category: 'post_processing',
    description: 'Creative color manipulation for mood, style, and visual storytelling',
    prerequisites: ['exposure_correction'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Palette',
    relatedChallengeCategories: ['portrait', 'landscape', 'street', 'fine_art'],
  },
  {
    id: 'sharpening',
    name: 'Sharpening',
    category: 'post_processing',
    description: 'Applying output sharpening for screen and print without artifacts',
    prerequisites: ['raw_editing'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Sparkles',
    relatedChallengeCategories: ['portrait', 'macro', 'product', 'landscape'],
  },
  {
    id: 'noise_reduction',
    name: 'Noise Reduction',
    category: 'post_processing',
    description: 'Reducing digital noise while preserving detail and texture',
    prerequisites: ['raw_editing'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 2, icon: 'Eraser',
    relatedChallengeCategories: ['night', 'concert', 'indoor', 'astro'],
  },
  {
    id: 'local_adjustments',
    name: 'Local Adjustments',
    category: 'post_processing',
    description: 'Using brushes, gradients, and masks for targeted edits',
    prerequisites: ['exposure_correction', 'color_grading'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'PaintBucket',
    relatedChallengeCategories: ['portrait', 'landscape', 'product', 'fine_art'],
  },
  {
    id: 'batch_editing',
    name: 'Batch Editing',
    category: 'post_processing',
    description: 'Applying consistent edits across a series for cohesive output',
    prerequisites: ['color_grading'],
    xpToLearn: 100, xpToPractice: 500, xpToMaster: 2000,
    tier: 3, icon: 'Copy',
    relatedChallengeCategories: ['event', 'wedding', 'real_estate', 'product'],
  },
];

// ── Lookup helpers ──────────────────────────────────────────────────────────

const skillMap = new Map(SKILL_TREE.map((s) => [s.id, s]));

export function getSkillById(id: string): SkillNode | undefined {
  return skillMap.get(id);
}

export function getSkillsByCategory(category: SkillCategory): SkillNode[] {
  return SKILL_TREE.filter((s) => s.category === category);
}

// ── XP & Status Calculation ─────────────────────────────────────────────────

export function getStatusForXP(xp: number, skill: SkillNode): SkillStatus {
  if (xp >= skill.xpToMaster) return 'mastered';
  if (xp >= skill.xpToPractice) return 'practiced';
  if (xp >= skill.xpToLearn) return 'learned';
  return 'available';
}

export function getNextThreshold(status: SkillStatus, skill: SkillNode): number {
  if (status === 'locked' || status === 'available') return skill.xpToLearn;
  if (status === 'learned') return skill.xpToPractice;
  if (status === 'practiced') return skill.xpToMaster;
  return skill.xpToMaster; // mastered
}

export function arePrerequisitesMet(
  skillId: string,
  userSkills: Map<string, UserSkillState>,
): boolean {
  const skill = skillMap.get(skillId);
  if (!skill) return false;
  if (skill.prerequisites.length === 0) return true;
  return skill.prerequisites.every((preReqId) => {
    const state = userSkills.get(preReqId);
    return state && (state.status === 'learned' || state.status === 'practiced' || state.status === 'mastered');
  });
}

/**
 * Determine which skills should receive XP based on a challenge category.
 * Returns skill IDs that match the category.
 */
export function getSkillsForCategory(category: string): string[] {
  const normalized = category.toLowerCase().replace(/\s+/g, '_');
  return SKILL_TREE
    .filter((s) => s.relatedChallengeCategories.includes(normalized))
    .map((s) => s.id);
}

// ── XP Award Amounts ────────────────────────────────────────────────────────

export const XP_AMOUNTS = {
  CHALLENGE_COMPLETE_BASE: 50,
  CHALLENGE_COMPLETE_MEDIUM: 100,
  CHALLENGE_COMPLETE_DEEP: 200,
  CHALLENGE_COMPLETE_STORY: 300,
  CHALLENGE_COMPLETE_MASTERY: 150,
  SUBMISSION: 25,
  CRITIQUE_SCORE_BONUS: 50, // per dimension above threshold
  CRITIQUE_SCORE_THRESHOLD: 70,
  STREAK_DAILY: 10,
  PLAN_STEP: 15, // a plan step with a linked photo or frame (refactor 2E-2a)
} as const;

/** Skills that take XP for work that has no category of its own (submissions, plan steps). */
export const FOUNDATIONAL_SKILLS: string[] = ['exposure_triangle', 'rule_of_thirds', 'raw_editing'];

/**
 * Calculate XP to award for a challenge completion based on type/difficulty.
 */
export function getXPForChallenge(challengeType: string, difficulty: string): number {
  if (challengeType === 'STORY_DRIVEN') return XP_AMOUNTS.CHALLENGE_COMPLETE_STORY;
  if (challengeType === 'TECHNICAL_MASTERY') return XP_AMOUNTS.CHALLENGE_COMPLETE_MASTERY;
  if (difficulty === 'deep') return XP_AMOUNTS.CHALLENGE_COMPLETE_DEEP;
  if (difficulty === 'medium') return XP_AMOUNTS.CHALLENGE_COMPLETE_MEDIUM;
  return XP_AMOUNTS.CHALLENGE_COMPLETE_BASE;
}

/**
 * Calculate XP bonus from critique scores.
 * Awards XP_AMOUNTS.CRITIQUE_SCORE_BONUS per dimension above threshold.
 */
export function getXPForCritiqueScores(scores: {
  technical: number;
  composition: number;
  creative: number;
}): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let total = 0;

  if (scores.technical > XP_AMOUNTS.CRITIQUE_SCORE_THRESHOLD) {
    breakdown.technical = XP_AMOUNTS.CRITIQUE_SCORE_BONUS;
    total += XP_AMOUNTS.CRITIQUE_SCORE_BONUS;
  }
  if (scores.composition > XP_AMOUNTS.CRITIQUE_SCORE_THRESHOLD) {
    breakdown.composition = XP_AMOUNTS.CRITIQUE_SCORE_BONUS;
    total += XP_AMOUNTS.CRITIQUE_SCORE_BONUS;
  }
  if (scores.creative > XP_AMOUNTS.CRITIQUE_SCORE_THRESHOLD) {
    breakdown.creative = XP_AMOUNTS.CRITIQUE_SCORE_BONUS;
    total += XP_AMOUNTS.CRITIQUE_SCORE_BONUS;
  }

  return { total, breakdown };
}

// ── Level Calculation ───────────────────────────────────────────────────────

/**
 * Calculate user level from total XP.
 * Levels use a simple formula: level = floor(sqrt(totalXP / 100)) + 1
 * Level 1 = 0 XP, Level 2 = 100 XP, Level 5 = 1600 XP, Level 10 = 8100 XP
 */
export function getLevelFromXP(totalXP: number): { level: number; xpForCurrentLevel: number; xpForNextLevel: number; progress: number } {
  const level = Math.floor(Math.sqrt(totalXP / 100)) + 1;
  const xpForCurrentLevel = Math.pow(level - 1, 2) * 100;
  const xpForNextLevel = Math.pow(level, 2) * 100;
  const progress = xpForNextLevel > xpForCurrentLevel
    ? Math.round(((totalXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100)
    : 100;

  return { level, xpForCurrentLevel, xpForNextLevel, progress };
}
