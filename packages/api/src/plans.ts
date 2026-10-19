// v2 shoot plans: generate a gear-checked plan for a Google place or one of the user's spots,
// list and read plans, and update a plan's or a step's status. A plan keeps only the place_id
// or spot id; the place name is fetched fresh on read. Step status is last-write-wins by the
// client's updatedAt, and an older or repeated write is answered with the stored step and
// applied: false, never an error, so an offline queue never stops.

import { AiError, generateShootPlan, type PlanPlace } from '@fotoai/ai';
import { parseGeneratePlanInput, PlanPatch, StepPatch, type PlanStepDto, type PlanSummaryDto, type ShootPlanDto } from '@fotoai/contracts';
import { lightTimes, localDate, timezoneAt, toZonedIso, type Body, type Loadout, type Settings } from '@fotoai/core';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { loadSavedLoadout } from './gear.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { readJsonObject } from './http.ts';
import { placesConfigured, placesFor, requirePlaces } from './places-client.ts';
import { reserveCalls } from './rate-limit.ts';

const T_PLANS = 'fotoai_shoot_plans';
const T_STEPS = 'fotoai_plan_steps';
const PLAN_COLUMNS = 'id, place_source, place_id, spot_id, plan_date, timezone, title, summary, loadout, notes, status, created_at, updated_at';
const STEP_COLUMNS = 'id, position, title, instruction, tip, starts_at, settings, status, updated_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FUTURE_SLACK_MS = 5 * 60_000;

type PlanRow = {
  id: string;
  place_source: 'google' | 'user';
  place_id: string | null;
  spot_id: string | null;
  plan_date: string;
  timezone: string;
  title: string;
  summary: string;
  loadout: { body: { name: string }; lens: { name: string }; film: { stock: string } | null };
  notes: string[];
  status: PlanSummaryDto['status'];
  created_at: string;
  updated_at: string;
};

type StepRow = {
  id: string;
  position: number;
  title: string;
  instruction: string;
  tip: string | null;
  starts_at: string | null;
  settings: Settings;
  status: PlanStepDto['status'];
  updated_at: string;
};

const upstream = (what: string) => new ApiError('upstream', `Could not ${what}`);
export const fromAi = (err: unknown) => (err instanceof AiError ? new ApiError(err.code, err.message) : err);

export function requireAi(deps: V2Deps): void {
  if (!deps.ai.configured) throw new ApiError('config', 'AI is not configured');
}

function idParam(params: Record<string, string>, key: string): string {
  const id = params[key] ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', `${key} must be a UUID`);
  return id;
}

function toSummary(row: PlanRow): PlanSummaryDto {
  return {
    id: row.id,
    placeSource: row.place_source,
    placeId: row.place_id,
    spotId: row.spot_id,
    date: row.plan_date,
    timezone: row.timezone,
    title: row.title,
    summary: row.summary,
    loadout: { body: row.loadout.body.name, lens: row.loadout.lens.name, film: row.loadout.film?.stock ?? null },
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const toStep = (row: StepRow, timezone: string): PlanStepDto => ({
  id: row.id,
  position: row.position,
  title: row.title,
  instruction: row.instruction,
  tip: row.tip,
  startsAt: row.starts_at ? toZonedIso(new Date(row.starts_at), timezone) : null,
  settings: row.settings,
  status: row.status,
  updatedAt: row.updated_at,
});

/** The place name, fresh from Google or the user's spot; never fails the read. */
async function placeNameFor(deps: V2Deps, principal: Principal, row: PlanRow): Promise<{ name: string | null; unavailable: boolean }> {
  const missing = { name: null, unavailable: true };
  if (row.place_source === 'google') {
    if (!placesConfigured(deps) || !row.place_id) return missing;
    try {
      await reserveCalls(deps.env, principal, 'places', 1, deps.now());
      const place = await placesFor(deps).details(row.place_id, 'summary');
      return place ? { name: place.name, unavailable: false } : missing;
    } catch {
      return missing;
    }
  }
  if (!row.spot_id) return missing;
  const { data } = await createUserClient(deps.env, principal.accessToken).from('fotoai_places').select('name').eq('id', row.spot_id).maybeSingle();
  const name = (data as { name: string | null } | null)?.name ?? null;
  return name ? { name, unavailable: false } : missing;
}

/** Where the plan is: the place facts for the prompt, the row fields, and the name to show. */
async function resolvePlace(deps: V2Deps, principal: Principal, input: { placeId: string } | { spotId: string }) {
  let placeId = 'placeId' in input ? input.placeId : null;
  let spotId: string | null = null;
  if ('spotId' in input) {
    const { data, error } = await createUserClient(deps.env, principal.accessToken)
      .from('fotoai_places')
      .select('id, source, place_id, name, lat, lng, notes')
      .eq('id', input.spotId)
      .maybeSingle();
    if (error) throw upstream('load the spot');
    const spot = data as { id: string; source: string; place_id: string | null; name: string | null; lat: number | null; lng: number | null; notes: string | null } | null;
    if (!spot) throw new ApiError('not_found', 'Spot not found');
    spotId = spot.id;
    if (spot.source === 'user') {
      const place: PlanPlace = { kind: 'pin', name: spot.name!, notes: spot.notes, location: { lat: spot.lat!, lng: spot.lng! } };
      return { place, placeSource: 'user' as const, placeId: null, spotId, name: spot.name! };
    }
    placeId = spot.place_id;
  }
  requirePlaces(deps);
  await reserveCalls(deps.env, principal, 'places', 1, deps.now());
  const details = await placesFor(deps).details(placeId!, 'summary');
  if (!details) throw new ApiError('not_found', 'Google has no such place');
  const place: PlanPlace = { kind: 'google', placeId: details.placeId, name: details.name, types: details.types, location: details.location };
  return { place, placeSource: 'google' as const, placeId: details.placeId, spotId, name: details.name };
}

export const generatePlan: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = parseGeneratePlanInput(body);
  if (!parsed.success) throw new ApiError('validation', `Invalid plan request: ${[...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))].join(', ')}`);
  requireAi(deps);

  const saved = await loadSavedLoadout(deps, principal);
  if (!saved) throw new ApiError('validation', 'Set your loadout first');
  const loadout: Loadout = { body: saved.body.capability as Body, lens: saved.lens, ...(saved.film ? { film: saved.film } : {}) };
  if (loadout.body.type === 'film' && !loadout.film) throw new ApiError('validation', 'Load a film first');

  // The plan limit comes before any Google call, so a refused plan costs no Places call.
  await reserveCalls(deps.env, principal, 'plan_generate', 1, deps.now());
  const where = await resolvePlace(deps, principal, parsed.data);
  const { lat, lng } = where.place.location;
  const timezone = timezoneAt(lat, lng);
  const date = parsed.data.date ?? localDate(deps.now(), timezone);
  let light;
  try {
    light = lightTimes(lat, lng, date);
  } catch (err) {
    if (err instanceof RangeError) throw new ApiError('validation', err.message);
    throw err;
  }

  const db = createUserClient(deps.env, principal.accessToken);
  const [weather, skills, critiques] = await Promise.all([
    deps.weather.get(lat, lng),
    db.from('fotoai_user_skills').select('skill_id, status').eq('user_id', principal.userId).limit(30),
    db.from('fotoai_photo_critiques').select('improvements').eq('user_id', principal.userId).order('critique_date', { ascending: false }).limit(5),
  ]);
  if (skills.error || critiques.error) throw upstream('load your skills');
  const weaknesses = [...new Set((critiques.data as Array<{ improvements: string[] | null }>).flatMap((c) => c.improvements ?? []))].slice(0, 5);

  let draft;
  try {
    draft = await generateShootPlan(deps.ai, {
      place: where.place,
      date,
      light,
      weather,
      loadout,
      skills: (skills.data as Array<{ skill_id: string; status: string }>).map((s) => ({ id: s.skill_id, status: s.status })),
      recentWeaknesses: weaknesses,
    });
  } catch (err) {
    throw fromAi(err);
  }

  const { data: planData, error: planError } = await db
    .from(T_PLANS)
    .insert({
      user_id: principal.userId,
      place_source: where.placeSource,
      place_id: where.placeId,
      spot_id: where.spotId,
      plan_date: date,
      timezone,
      title: draft.title || 'Shoot plan',
      summary: draft.summary,
      loadout: {
        body: { gearId: saved.body.id, catalogId: saved.body.catalogId, name: saved.body.name },
        lens: { gearId: saved.lensGearId, id: saved.lens.id, name: `${saved.lens.make} ${saved.lens.model}` },
        film: saved.film,
      },
      notes: draft.notes,
      prompt_id: draft.prompt.id,
      prompt_version: draft.prompt.version,
      model: draft.model,
    } as never)
    .select(PLAN_COLUMNS)
    .single();
  if (planError || !planData) throw upstream('save the plan');
  const plan = planData as unknown as PlanRow;

  const { data: stepData, error: stepError } = await db
    .from(T_STEPS)
    .insert(
      draft.steps.map((step, i) => ({
        plan_id: plan.id,
        user_id: principal.userId,
        position: i + 1,
        title: step.title,
        instruction: step.instruction,
        tip: step.tip,
        starts_at: step.startsAt,
        settings: step.settings,
      })) as never,
    )
    .select(STEP_COLUMNS)
    .order('position');
  if (stepError || !stepData) {
    // Never leave a half plan; if even that fails, say so (the plan id only, no text).
    const { error: cleanupError } = await db.from(T_PLANS).delete().eq('id', plan.id);
    if (cleanupError) console.warn(`FotoAI v2 plan cleanup failed for plan ${plan.id}`);
    throw upstream('save the plan steps');
  }

  const dto: ShootPlanDto = {
    ...toSummary(plan),
    placeName: where.name,
    placeUnavailable: false,
    steps: (stepData as unknown as StepRow[]).map((s) => toStep(s, plan.timezone)),
  };
  return json({ plan: dto }, { status: 201 });
};

export const listPlans: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_PLANS)
    .select(PLAN_COLUMNS)
    .eq('user_id', principal.userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw upstream('load plans');
  return json({ plans: (data as unknown as PlanRow[]).map(toSummary) });
};

async function readPlan(deps: V2Deps, principal: Principal, id: string): Promise<PlanRow> {
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_PLANS).select(PLAN_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw upstream('load the plan');
  if (!data) throw new ApiError('not_found', 'Plan not found');
  return data as unknown as PlanRow;
}

export const getPlan: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const plan = await readPlan(deps, principal, idParam(params, 'id'));
  const [{ data: steps, error }, place] = await Promise.all([
    createUserClient(deps.env, principal.accessToken).from(T_STEPS).select(STEP_COLUMNS).eq('plan_id', plan.id).order('position'),
    placeNameFor(deps, principal, plan),
  ]);
  if (error) throw upstream('load the plan steps');
  const dto: ShootPlanDto = {
    ...toSummary(plan),
    placeName: place.name,
    placeUnavailable: place.unavailable,
    steps: (steps as unknown as StepRow[]).map((s) => toStep(s, plan.timezone)),
  };
  return json({ plan: dto });
};

export const patchPlan: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = idParam(params, 'id');
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = PlanPatch.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', 'Invalid plan change: status');
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_PLANS)
    .update({ status: parsed.data.status, updated_at: deps.now().toISOString() } as never)
    .eq('id', id)
    .select(PLAN_COLUMNS)
    .maybeSingle();
  if (error) throw upstream('save the plan');
  if (!data) throw new ApiError('not_found', 'Plan not found');
  return json({ plan: toSummary(data as unknown as PlanRow) });
};

export const patchPlanStep: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const planId = idParam(params, 'id');
  const stepId = idParam(params, 'stepId');
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = StepPatch.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', `Invalid step change: ${[...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))].join(', ')}`);
  const at = Date.parse(parsed.data.updatedAt);
  if (at > deps.now().getTime() + FUTURE_SLACK_MS) throw new ApiError('validation', 'updatedAt is in the future');
  const updatedAt = new Date(at).toISOString();

  const plan = await readPlan(deps, principal, planId);
  const db = createUserClient(deps.env, principal.accessToken);
  // Applied only when newer than the stored write; an older or repeated write changes nothing.
  const { data, error } = await db
    .from(T_STEPS)
    .update({ status: parsed.data.status, updated_at: updatedAt } as never)
    .eq('id', stepId)
    .eq('plan_id', planId)
    .lt('updated_at', updatedAt)
    .select(STEP_COLUMNS)
    .maybeSingle();
  if (error) throw upstream('save the step');
  if (data) return json({ step: toStep(data as unknown as StepRow, plan.timezone), applied: true });

  const { data: stored, error: readError } = await db.from(T_STEPS).select(STEP_COLUMNS).eq('id', stepId).eq('plan_id', planId).maybeSingle();
  if (readError) throw upstream('load the step');
  if (!stored) throw new ApiError('not_found', 'Step not found');
  return json({ step: toStep(stored as unknown as StepRow, plan.timezone), applied: false });
};
