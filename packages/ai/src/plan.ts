// The shoot plan generator. Every step goes through the gear checks: a plan with broken steps
// is asked again once, with the issues listed; a step that then breaks only exposure limits is
// clamped with the exposure kept equal, and any other broken step is dropped. Each change adds a
// note. A Google place's name is replaced with "this spot" so no Google content is saved.

import { clampSettings, validateSettings, type Settings, type SettingIssue } from '@fotoai/core';

import { AiError, type AiClient } from './client.ts';
import { SHOOT_PLAN_V1, type PlanInput, type ShootPlanOutput } from './prompts/shoot-plan.v1.ts';

export interface DraftStep {
  title: string;
  instruction: string;
  tip: string | null;
  startsAt: string | null;
  settings: Settings;
}

export interface ShootPlanDraft {
  title: string;
  summary: string;
  steps: DraftStep[];
  notes: string[];
  prompt: { id: string; version: number };
  model: string;
}

const MAX_STEPS = 8;
const EXPOSURE_FIELDS = new Set<SettingIssue['field']>(['shutterSeconds', 'aperture', 'iso']);
const ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/;
const DAY_MS = 86_400_000;

const cut = (text: string, max: number) => text.trim().slice(0, max);

function toSettings(raw: ShootPlanOutput['steps'][number]['settings']): Settings {
  const s: Settings = { mode: raw.mode };
  if (raw.aperture !== null) s.aperture = raw.aperture;
  if (raw.shutterSeconds !== null) s.shutterSeconds = raw.shutterSeconds;
  if (raw.iso !== null) s.iso = raw.iso;
  if (raw.focalMm !== null) s.focalMm = raw.focalMm;
  if (raw.whiteBalance !== null) s.whiteBalance = cut(raw.whiteBalance, 40);
  if (raw.filmSimulation !== null) s.filmSimulation = cut(raw.filmSimulation, 40);
  return s;
}

/** A zoned time on the plan date or a day either side; anything else is dropped. */
function startsAtOn(value: string | null, date: string): string | null {
  if (!value || !ZONED.test(value) || Number.isNaN(Date.parse(value))) return null;
  const day = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return Math.abs(day - Date.parse(`${date}T00:00:00Z`)) <= DAY_MS ? value : null;
}

/** Text is cleaned (the Google name replaced) before it is cut, so it always fits the limits. */
function toDraftSteps(output: ShootPlanOutput, date: string, clean: (text: string) => string): DraftStep[] {
  return output.steps.slice(0, MAX_STEPS).map((step) => ({
    title: cut(clean(step.title), 80),
    instruction: cut(clean(step.instruction), 600),
    tip: step.tip ? cut(clean(step.tip), 200) || null : null,
    startsAt: startsAtOn(step.startsAt, date),
    settings: toSettings(step.settings),
  }));
}

const issuesOf = (input: PlanInput, steps: DraftStep[]) =>
  steps.map((step) => {
    const check = validateSettings(input.loadout, step.settings);
    return check.ok ? [] : check.issues;
  });

/** Replaces the name as a whole word or phrase, any case ("Fed" is not replaced inside "Federal"). */
function scrub(text: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), 'this spot');
}

export async function generateShootPlan(ai: AiClient, input: PlanInput): Promise<ShootPlanDraft> {
  const notes: string[] = [];
  const name = input.place.kind === 'google' ? input.place.name : null;
  const clean = (text: string) => (name ? scrub(text, name) : text);
  let output = (await ai.generate(SHOOT_PLAN_V1, input)).output;
  let steps = toDraftSteps(output, input.date, clean);
  let issues = issuesOf(input, steps);

  if (issues.some((list) => list.length > 0)) {
    const listing = issues
      .map((list, i) => (list.length ? `- Step ${i + 1}: ${list.map((issue) => issue.message).join('; ')}` : null))
      .filter(Boolean)
      .join('\n');
    output = (await ai.generate(SHOOT_PLAN_V1, input, { extra: `Some steps break the gear limits. Answer with the whole plan again, fixing:\n${listing}` })).output;
    steps = toDraftSteps(output, input.date, clean);
    issues = issuesOf(input, steps);
  }

  const kept: DraftStep[] = [];
  steps.forEach((step, i) => {
    if (!step.title || !step.instruction) return void notes.push(`Step ${i + 1} dropped: empty title or instruction`);
    const list = issues[i]!;
    if (list.length === 0) return void kept.push(step);
    if (list.every((issue) => EXPOSURE_FIELDS.has(issue.field))) {
      const { settings, changes } = clampSettings(input.loadout, step.settings);
      if (validateSettings(input.loadout, settings).ok) {
        notes.push(`Step ${i + 1} adjusted: ${changes.map((c) => c.message).join('; ')}`);
        return void kept.push({ ...step, settings });
      }
    }
    notes.push(`Step ${i + 1} dropped: ${list.map((issue) => issue.message).join('; ')}`);
  });
  if (kept.length === 0) throw new AiError('upstream', 'The plan had no usable steps');

  return {
    title: cut(clean(output.title), 80),
    summary: cut(clean(output.summary), 400),
    steps: kept,
    notes,
    prompt: { id: SHOOT_PLAN_V1.id, version: SHOOT_PLAN_V1.version },
    model: ai.modelId,
  };
}
