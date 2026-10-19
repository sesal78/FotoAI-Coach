// v2 film rolls and frames. Ids come from the phone, so a replayed offline write returns the
// stored record with 200. A frame's settings are checked against the roll's camera, the lens and
// the roll's film; frames are append-only. A frame linked to a plan step earns plan-step XP (the
// award is duplicate-safe, so a replay can safely try again).

import { FrameInput, RollInput, RollPatch, ROLL_STATUSES, ScanMatchInput, type FrameDto, type RollDto } from '@fotoai/contracts';
import { findLens, findStock, framesLeft, validateSettings, type Body, type Lens, type Settings } from '@fotoai/core';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { loadGearItems } from './gear.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { readJsonObject } from './http.ts';
import { awardPlanStepXp } from './privileged/xp.ts';

const T_ROLLS = 'fotoai_film_rolls';
const T_FRAMES = 'fotoai_film_frames';
const ROLL_COLUMNS = 'id, stock_id, stock_name, box_iso, rated_iso, exposures, body_gear_id, status, loaded_at, finished_at, notes, created_at, updated_at';
const FRAME_COLUMNS = 'id, frame_no, settings, lens_gear_id, step_id, lat, lng, note, shot_at, created_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTRA_FRAMES = 2; // a 36-exposure roll often gives 37 or 38 frames

type RollRow = {
  id: string;
  stock_id: string | null;
  stock_name: string;
  box_iso: number;
  rated_iso: number;
  exposures: number;
  body_gear_id: string | null;
  status: RollDto['status'];
  loaded_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FrameRow = {
  id: string;
  frame_no: number;
  settings: Settings;
  lens_gear_id: string | null;
  step_id: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  shot_at: string;
  created_at: string;
};

const upstream = (what: string) => new ApiError('upstream', `Could not ${what}`);

function fieldsOf(issues: Array<{ path: PropertyKey[] }>): string {
  return [...new Set(issues.map((i) => i.path.map(String).join('.') || 'body'))].join(', ');
}

function idParam(params: Record<string, string>): string {
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Roll id must be a UUID');
  return id;
}

function toRoll(row: RollRow, logged: number): RollDto {
  return {
    id: row.id,
    stockId: row.stock_id,
    stockName: row.stock_name,
    boxIso: row.box_iso,
    ratedIso: row.rated_iso,
    exposures: row.exposures,
    bodyGearId: row.body_gear_id,
    status: row.status,
    loadedAt: row.loaded_at,
    finishedAt: row.finished_at,
    notes: row.notes,
    framesLogged: logged,
    framesLeft: framesLeft({ exposures: row.exposures, framesLogged: logged }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const toFrame = (row: FrameRow): FrameDto => ({
  id: row.id,
  frameNo: row.frame_no,
  settings: row.settings,
  lensGearId: row.lens_gear_id,
  stepId: row.step_id,
  lat: row.lat,
  lng: row.lng,
  note: row.note,
  shotAt: row.shot_at,
  createdAt: row.created_at,
});

async function readRoll(deps: V2Deps, principal: Principal, id: string): Promise<RollRow> {
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_ROLLS).select(ROLL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw upstream('load the roll');
  if (!data) throw new ApiError('not_found', 'Roll not found');
  return data as unknown as RollRow;
}

async function frameCounts(deps: V2Deps, principal: Principal, rollIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (rollIds.length === 0) return counts;
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_FRAMES).select('roll_id').in('roll_id', rollIds);
  if (error) throw upstream('count frames');
  for (const row of data as Array<{ roll_id: string }>) counts.set(row.roll_id, (counts.get(row.roll_id) ?? 0) + 1);
  return counts;
}

export const createRoll: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = RollInput.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', `Invalid roll: ${fieldsOf(parsed.error.issues)}`);
  const input = parsed.data;
  const db = createUserClient(deps.env, principal.accessToken);

  const { data: existing, error: readError } = await db.from(T_ROLLS).select(ROLL_COLUMNS).eq('id', input.id).maybeSingle();
  if (readError) throw upstream('load the roll');
  if (existing) {
    const counts = await frameCounts(deps, principal, [input.id]);
    return json({ roll: toRoll(existing as unknown as RollRow, counts.get(input.id) ?? 0) });
  }

  let name: string;
  let boxIso: number;
  let ratedIso: number;
  if (input.stockId) {
    const stock = findStock(input.stockId);
    if (!stock) throw new ApiError('validation', 'Unknown film stock; give stockName and boxIso instead');
    name = stock.names[0]!;
    boxIso = stock.boxIso;
    ratedIso = input.ratedIso ?? stock.ratedIso ?? stock.boxIso;
  } else {
    name = input.stockName!;
    boxIso = input.boxIso!;
    ratedIso = input.ratedIso ?? boxIso;
  }

  const gear = (await loadGearItems(deps, principal.accessToken, [input.bodyGearId])).get(input.bodyGearId);
  if (!gear) throw new ApiError('not_found', 'Body gear not found');
  if (gear.kind !== 'body' || (gear.capability as Body | null)?.type !== 'film') throw new ApiError('validation', 'Load a roll in a film camera');

  const { data, error } = await db
    .from(T_ROLLS)
    .insert({
      id: input.id,
      user_id: principal.userId,
      stock_id: input.stockId ?? null,
      stock_name: name,
      box_iso: boxIso,
      rated_iso: ratedIso,
      exposures: input.exposures,
      body_gear_id: input.bodyGearId,
      notes: input.notes ?? null,
    } as never)
    .select(ROLL_COLUMNS)
    .single();
  if (error?.code === '23505') throw new ApiError('validation', 'This roll id is already in use');
  if (error || !data) throw upstream('save the roll');
  return json({ roll: toRoll(data as unknown as RollRow, 0) }, { status: 201 });
};

export const listRolls: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_ROLLS)
    .select(ROLL_COLUMNS)
    .eq('user_id', principal.userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw upstream('load rolls');
  const rows = data as unknown as RollRow[];
  const counts = await frameCounts(deps, principal, rows.map((r) => r.id));
  return json({ rolls: rows.map((r) => toRoll(r, counts.get(r.id) ?? 0)) });
};

export const getRoll: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const roll = await readRoll(deps, principal, idParam(params));
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_FRAMES).select(FRAME_COLUMNS).eq('roll_id', roll.id).order('frame_no');
  if (error) throw upstream('load frames');
  const frames = (data as unknown as FrameRow[]).map(toFrame);
  return json({ roll: { ...toRoll(roll, frames.length), frames } });
};

export const patchRoll: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = idParam(params);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = RollPatch.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', 'Invalid roll change: status');
  const roll = await readRoll(deps, principal, id);
  const from = ROLL_STATUSES.indexOf(roll.status);
  const to = ROLL_STATUSES.indexOf(parsed.data.status);
  if (to < from) throw new ApiError('validation', `A ${roll.status} roll cannot go back to ${parsed.data.status}`);
  const now = deps.now().toISOString();
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_ROLLS)
    .update({ status: parsed.data.status, finished_at: roll.finished_at ?? (to >= 1 ? now : null), updated_at: now } as never)
    .eq('id', id)
    .select(ROLL_COLUMNS)
    .single();
  if (error || !data) throw upstream('save the roll');
  const counts = await frameCounts(deps, principal, [id]);
  return json({ roll: toRoll(data as unknown as RollRow, counts.get(id) ?? 0) });
};

export const deleteRoll: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = idParam(params);
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_ROLLS).delete().eq('id', id).select('id');
  if (error) throw upstream('delete the roll');
  if (!data || data.length === 0) throw new ApiError('not_found', 'Roll not found');
  return json({ success: true });
};

/** The settings must be possible on the roll's camera and lens with the roll's film. */
async function checkFrameSettings(deps: V2Deps, principal: Principal, roll: RollRow, input: FrameInput): Promise<void> {
  if (!roll.body_gear_id) return; // the camera was removed from My gear: nothing to check against
  const ids = [roll.body_gear_id, ...(input.lensGearId ? [input.lensGearId] : [])];
  const items = await loadGearItems(deps, principal.accessToken, ids);
  const body = items.get(roll.body_gear_id)?.capability as Body | null | undefined;
  if (!body) return;
  let lens: Lens | undefined;
  if (body.fixedLensId) lens = findLens(body.fixedLensId);
  else if (input.lensGearId) {
    const item = items.get(input.lensGearId);
    if (!item) throw new ApiError('not_found', 'Lens gear not found');
    if (item.kind !== 'lens' || !item.capability) throw new ApiError('validation', 'lensGearId is not a lens with capability data');
    lens = item.capability as Lens;
  } else throw new ApiError('validation', 'lensGearId is required for this camera');
  const film = { stock: roll.stock_name, boxIso: roll.box_iso, ratedIso: roll.rated_iso };
  const check = validateSettings({ body, lens: lens!, film }, input.settings as Settings);
  if (!check.ok) {
    throw new ApiError('validation', `Frame settings not possible: ${check.issues.map((i) => `${i.field} (${i.message})`).join('; ')}`);
  }
}

export const addFrame: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const rollId = idParam(params);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = FrameInput.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', `Invalid frame: ${fieldsOf(parsed.error.issues)}`);
  const input = parsed.data;
  const roll = await readRoll(deps, principal, rollId);
  const db = createUserClient(deps.env, principal.accessToken);

  const award = async (stepId: string | null) => {
    if (stepId) await awardPlanStepXp(deps.env, principal.userId, stepId);
  };

  const { data: existing, error: readError } = await db.from(T_FRAMES).select(FRAME_COLUMNS).eq('id', input.id).eq('roll_id', rollId).maybeSingle();
  if (readError) throw upstream('load the frame');
  if (existing) {
    const row = existing as unknown as FrameRow;
    await award(row.step_id); // duplicate-safe: completes an award a crash may have missed
    return json({ frame: toFrame(row) });
  }

  if (input.frameNo > roll.exposures + EXTRA_FRAMES) {
    throw new ApiError('validation', `Frame ${input.frameNo} is past the end of a ${roll.exposures}-exposure roll`);
  }
  await checkFrameSettings(deps, principal, roll, input);
  if (input.stepId) {
    const { data: step, error } = await db.from('fotoai_plan_steps').select('id').eq('id', input.stepId).maybeSingle();
    if (error) throw upstream('load the step');
    if (!step) throw new ApiError('not_found', 'Step not found');
  }

  const { data, error } = await db
    .from(T_FRAMES)
    .insert({
      id: input.id,
      roll_id: rollId,
      user_id: principal.userId,
      frame_no: input.frameNo,
      settings: input.settings,
      lens_gear_id: input.lensGearId ?? null,
      step_id: input.stepId ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      note: input.note ?? null,
      shot_at: input.shotAt,
    } as never)
    .select(FRAME_COLUMNS)
    .single();
  if (error?.code === '23505') {
    const detail = `${error.message} ${error.details ?? ''}`;
    if (/roll_frame_key|frame_no/.test(detail)) throw new ApiError('validation', `Frame ${input.frameNo} is already logged on this roll`);
    throw new ApiError('validation', 'This frame id is already in use');
  }
  if (error || !data) throw upstream('save the frame');
  const frame = data as unknown as FrameRow;
  await award(frame.step_id);
  return json({ frame: toFrame(frame) }, { status: 201 });
};

/**
 * POST /api/v2/rolls/:id/scans: pairs the caller's ready scans to the roll's frames. Overrides go
 * first; the other scans fill the remaining frames in frame order, in the order sent. A scan past
 * the last free frame stays on the roll with no frame. Matching again replaces these scans' links.
 * A frame linked to a plan step earns plan-step XP (a duplicate if it already did).
 */
export const matchScans: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const rollId = idParam(params);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = ScanMatchInput.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', `Invalid scan match: ${fieldsOf(parsed.error.issues)}`);
  const { photoIds, overrides = {} } = parsed.data;
  await readRoll(deps, principal, rollId);
  const db = createUserClient(deps.env, principal.accessToken);

  const { data: photoData, error: photoError } = await db.from('fotoai_photos').select('id, source, status').in('id', photoIds);
  if (photoError) throw upstream('load the scans');
  const photos = new Map((photoData as Array<{ id: string; source: string; status: string }>).map((p) => [p.id, p]));
  for (const id of photoIds) {
    const photo = photos.get(id);
    if (!photo) throw new ApiError('not_found', 'Photo not found');
    if (photo.source !== 'scan' || photo.status !== 'ready') throw new ApiError('validation', 'Only uploaded scans can be matched to frames');
  }

  const { data: frameData, error: frameError } = await db.from(T_FRAMES).select('id, frame_no, step_id').eq('roll_id', rollId).order('frame_no');
  if (frameError) throw upstream('load frames');
  const frames = frameData as Array<{ id: string; frame_no: number; step_id: string | null }>;
  const byNo = new Map(frames.map((f) => [f.frame_no, f]));

  const taken = new Set<number>();
  for (const [photoId, frameNo] of Object.entries(overrides)) {
    if (!photoIds.includes(photoId)) throw new ApiError('validation', 'An override names a photo that is not in photoIds');
    if (!byNo.has(frameNo)) throw new ApiError('validation', `Frame ${frameNo} is not logged on this roll`);
    if (taken.has(frameNo)) throw new ApiError('validation', `Two scans are matched to frame ${frameNo}`);
    taken.add(frameNo);
  }
  const free = frames.filter((f) => !taken.has(f.frame_no));
  const matches = photoIds.map((photoId) => {
    const frameNo = overrides[photoId] ?? free.shift()?.frame_no ?? null;
    return { photoId, frameNo };
  });

  const now = deps.now().toISOString();
  for (const match of matches) {
    const frame = match.frameNo === null ? null : byNo.get(match.frameNo)!;
    const { error } = await db
      .from('fotoai_photos')
      .update({ roll_id: rollId, frame_id: frame?.id ?? null, updated_at: now } as never)
      .eq('id', match.photoId);
    if (error) throw upstream('link the scans');
  }
  const steps = new Set(matches.map((m) => (m.frameNo === null ? null : byNo.get(m.frameNo)!.step_id)).filter((s): s is string => s !== null));
  for (const stepId of steps) await awardPlanStepXp(deps.env, principal.userId, stepId);
  return json({ matches });
};
