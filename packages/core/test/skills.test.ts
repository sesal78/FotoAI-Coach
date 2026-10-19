import { expect, test } from 'vitest';

import { FOUNDATIONAL_SKILLS, getSkillById, SKILL_TREE, XP_AMOUNTS } from '../src/index.ts';

test('the catalog has 35 skills with unique ids', () => {
  const ids = SKILL_TREE.map((s) => s.id);
  expect(ids).toHaveLength(35);
  expect(new Set(ids).size).toBe(35);
});

test('every prerequisite names a skill in the catalog', () => {
  for (const skill of SKILL_TREE) {
    for (const pre of skill.prerequisites) expect(getSkillById(pre), `${skill.id} needs ${pre}`).toBeDefined();
  }
});

test('thresholds rise: learn < practice < master', () => {
  for (const s of SKILL_TREE) {
    expect(s.xpToLearn, s.id).toBeLessThan(s.xpToPractice);
    expect(s.xpToPractice, s.id).toBeLessThan(s.xpToMaster);
  }
});

test('the 3 foundational skills exist and have no prerequisites', () => {
  expect(FOUNDATIONAL_SKILLS).toEqual(['exposure_triangle', 'rule_of_thirds', 'raw_editing']);
  for (const id of FOUNDATIONAL_SKILLS) expect(getSkillById(id)?.prerequisites, id).toEqual([]);
});

test('XP amounts keep the live values and add the plan step', () => {
  expect(XP_AMOUNTS).toMatchObject({ SUBMISSION: 25, CHALLENGE_COMPLETE_BASE: 50, PLAN_STEP: 15 });
});
