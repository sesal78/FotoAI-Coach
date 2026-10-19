// v2 photos: create a photo row and a one-time upload link, upload the bytes straight to
// Storage from the phone, then confirm. Ids come from the phone, so a replayed create returns
// the same photo (with a fresh link while it is still pending). On confirm the upload is moved
// to a final key (so the upload link can no longer change what is served), a photo with no step
// is linked to a plan step by time when exactly one active step starts within 45 minutes, and,
// when AI is configured, the stored bytes are checked. A photo with a step earns plan-step XP
// (duplicate-safe) only when the check says it is safe and does not clearly miss the brief.

import { randomUUID } from 'node:crypto';

import { checkPhoto } from '@fotoai/ai';
import { PHOTO_MIME_EXTENSIONS, PhotoCreateInput, type PhotoDto, type PhotoMime } from '@fotoai/contracts';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { decodeCursor, encodeCursor } from './challenges.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { readJsonObject } from './http.ts';
import { moveObject, objectInfo, signedReadUrl, signedUploadUrl } from './privileged/storage.ts';
import { awardPlanStepXp } from './privileged/xp.ts';
import { reserveCalls } from './rate-limit.ts';

const T_PHOTOS = 'fotoai_photos';
const COLUMNS =
  'id, source, status, mime, bytes, object_key, taken_at, taken_offset, camera_make, camera_model, lens_model, focal_mm, aperture, shutter_s, iso, lat, lng, step_id, frame_id, roll_id, check_safe, check_matches, check_genre, checked_at, created_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATCH_WINDOW_MS = 45 * 60_000;
const READ_TTL_S = 300;
const CHECK_TTL_S = 120;
const PAGE = 50;

type PhotoRow = {
  id: string;
  source: PhotoDto['source'];
  status: PhotoDto['status'];
  mime: string;
  bytes: number;
  object_key: string;
  taken_at: string | null;
  taken_offset: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_mm: number | null;
  aperture: number | null;
  shutter_s: number | null;
  iso: number | null;
  lat: number | null;
  lng: number | null;
  step_id: string | null;
  frame_id: string | null;
  roll_id: string | null;
  check_safe: boolean | null;
  check_matches: 'yes' | 'no' | 'unclear' | null;
  check_genre: string | null;
  checked_at: string | null;
  created_at: string;
};

const upstream = (what: string) => new ApiError('upstream', `Could not ${what}`);
const num = (v: number | string | null) => (v === null ? null : Number(v));

const toPhoto = (row: PhotoRow): PhotoDto => ({
  id: row.id,
  source: row.source,
  status: row.status,
  mime: row.mime,
  bytes: Number(row.bytes),
  takenAt: row.taken_at,
  takenOffset: row.taken_offset,
  cameraMake: row.camera_make,
  cameraModel: row.camera_model,
  lensModel: row.lens_model,
  focalMm: num(row.focal_mm),
  aperture: num(row.aperture),
  shutterSeconds: num(row.shutter_s),
  iso: row.iso,
  lat: row.lat,
  lng: row.lng,
  stepId: row.step_id,
  frameId: row.frame_id,
  rollId: row.roll_id,
  check: row.checked_at
    ? { safe: row.check_safe === true, matchesBrief: row.check_matches, genre: row.check_genre, checkedAt: row.checked_at }
    : null,
  createdAt: row.created_at,
});

/** The final key for an upload: same folder, `-final` added to the name. */
const frozenKey = (key: string) => key.replace(/\.([a-z0-9]+)$/, '-final.$1');

function idParam(params: Record<string, string>): string {
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Photo id must be a UUID');
  return id;
}

async function readPhoto(deps: V2Deps, principal: Principal, id: string): Promise<PhotoRow | null> {
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_PHOTOS).select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw upstream('load the photo');
  return data as unknown as PhotoRow | null;
}

async function requireOwned(deps: V2Deps, principal: Principal, table: string, id: string, what: string): Promise<void> {
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(table as never).select('id').eq('id', id).maybeSingle();
  if (error) throw upstream(`load the ${what}`);
  if (!data) throw new ApiError('not_found', `${what[0]!.toUpperCase()}${what.slice(1)} not found`);
}

async function uploadFor(deps: V2Deps, principal: Principal, row: PhotoRow) {
  return signedUploadUrl(deps.env, principal.userId, row.object_key);
}

export const createPhoto: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = PhotoCreateInput.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', `Invalid photo: ${[...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'body'))].join(', ')}`);
  const input = parsed.data;

  const existing = await readPhoto(deps, principal, input.id);
  if (existing) {
    if (existing.status === 'ready') return json({ photo: toPhoto(existing) });
    return json({ photo: toPhoto(existing), upload: await uploadFor(deps, principal, existing) });
  }

  if (input.stepId) await requireOwned(deps, principal, 'fotoai_plan_steps', input.stepId, 'step');
  if (input.rollId) await requireOwned(deps, principal, 'fotoai_film_rolls', input.rollId, 'roll');
  await reserveCalls(deps.env, principal, 'photo_upload', 1, deps.now());

  const ext = PHOTO_MIME_EXTENSIONS[input.mime as PhotoMime];
  const key = `${principal.userId}/photos/${input.id}/${randomUUID().replace(/-/g, '').slice(0, 16)}.${ext}`;
  const exif = input.exif ?? {};
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_PHOTOS)
    .insert({
      id: input.id,
      user_id: principal.userId,
      source: input.source,
      object_key: key,
      mime: input.mime,
      bytes: input.bytes,
      taken_at: exif.takenAt ?? null,
      taken_offset: exif.takenOffset ?? null,
      camera_make: exif.cameraMake ?? null,
      camera_model: exif.cameraModel ?? null,
      lens_model: exif.lensModel ?? null,
      focal_mm: exif.focalMm ?? null,
      aperture: exif.aperture ?? null,
      shutter_s: exif.shutterSeconds ?? null,
      iso: exif.iso ?? null,
      lat: exif.lat ?? null,
      lng: exif.lng ?? null,
      step_id: input.stepId ?? null,
      roll_id: input.rollId ?? null,
    } as never)
    .select(COLUMNS)
    .single();
  if (error?.code === '23505') throw new ApiError('validation', 'This photo id is already in use');
  if (error || !data) throw upstream('save the photo');
  const row = data as unknown as PhotoRow;
  return json({ photo: toPhoto(row), upload: await uploadFor(deps, principal, row) }, { status: 201 });
};

/** The one active plan step that starts within 45 minutes of the photo, or null. */
async function matchStep(deps: V2Deps, principal: Principal, takenAt: string): Promise<string | null> {
  const t = Date.parse(takenAt);
  const db = createUserClient(deps.env, principal.accessToken);
  const { data, error } = await db
    .from('fotoai_plan_steps')
    .select('id, plan_id')
    .gte('starts_at', new Date(t - MATCH_WINDOW_MS).toISOString())
    .lte('starts_at', new Date(t + MATCH_WINDOW_MS).toISOString())
    .limit(10);
  if (error) throw upstream('match the photo');
  const steps = data as Array<{ id: string; plan_id: string }>;
  if (steps.length === 0) return null;
  const { data: plans, error: planError } = await db.from('fotoai_shoot_plans').select('id').in('id', [...new Set(steps.map((s) => s.plan_id))]).eq('status', 'active');
  if (planError) throw upstream('match the photo');
  const active = new Set((plans as Array<{ id: string }>).map((p) => p.id));
  const candidates = steps.filter((s) => active.has(s.plan_id));
  return candidates.length === 1 ? candidates[0]!.id : null;
}

/** Runs the AI check on the stored bytes and saves it; with no AI or a failed call the row is returned unchanged. */
async function runCheck(deps: V2Deps, principal: Principal, row: PhotoRow): Promise<PhotoRow> {
  if (!deps.ai.configured) return row;
  const db = createUserClient(deps.env, principal.accessToken);
  let brief: { title: string; instruction: string } | null = null;
  if (row.step_id) {
    const { data, error } = await db.from('fotoai_plan_steps').select('title, instruction').eq('id', row.step_id).maybeSingle();
    if (error) throw upstream('load the plan step');
    brief = data;
  }
  const url = await signedReadUrl(deps.env, principal.userId, row.object_key, CHECK_TTL_S);
  let check;
  try {
    check = await checkPhoto(deps.ai, { brief }, new URL(url));
  } catch {
    // The photo stays ready and unchecked; a confirm replay tries again. No key or URL is logged.
    console.warn('FotoAI v2 photo check did not run; the photo is kept unchecked');
    return row;
  }
  const { data, error } = await db
    .from(T_PHOTOS)
    .update({
      check_safe: check.safe,
      check_matches: check.matchesBrief,
      check_genre: check.genre,
      checked_at: deps.now().toISOString(),
      check_prompt: `${check.prompt.id}@v${check.prompt.version}`,
    } as never)
    .eq('id', row.id)
    .select(COLUMNS)
    .single();
  if (error || !data) throw upstream('save the photo check');
  return data as unknown as PhotoRow;
}

/** Plan-step XP (duplicate-safe) for a checked, safe photo that does not clearly miss the brief. */
async function awardIfEarned(deps: V2Deps, principal: Principal, row: PhotoRow): Promise<void> {
  if (row.step_id && row.checked_at && row.check_safe === true && row.check_matches !== 'no') {
    await awardPlanStepXp(deps.env, principal.userId, row.step_id);
  }
}

export const confirmPhoto: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const row = await readPhoto(deps, principal, idParam(params));
  if (!row) throw new ApiError('not_found', 'Photo not found');
  if (row.status === 'ready') {
    // A replay checks a photo that was never checked, and completes an award a crash may have missed.
    const checked = row.checked_at ? row : await runCheck(deps, principal, row);
    await awardIfEarned(deps, principal, checked);
    return json({ photo: toPhoto(checked) });
  }

  // A crash after the move leaves the bytes at the final key: carry on from there.
  const finalKey = frozenKey(row.object_key);
  let info = await objectInfo(deps.env, principal.userId, finalKey);
  const moved = info !== null;
  if (!info) info = await objectInfo(deps.env, principal.userId, row.object_key);
  if (!info) throw new ApiError('validation', 'Nothing has been uploaded for this photo yet');
  if (info.bytes !== Number(row.bytes)) throw new ApiError('validation', `The uploaded size (${info.bytes}) is not the declared size (${row.bytes})`);
  if (info.mime !== row.mime) throw new ApiError('validation', `The uploaded type (${info.mime}) is not the declared type (${row.mime})`);
  if (!moved) await moveObject(deps.env, principal.userId, row.object_key, finalKey);

  const stepId = row.step_id ?? (row.taken_at ? await matchStep(deps, principal, row.taken_at) : null);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_PHOTOS)
    .update({ status: 'ready', object_key: finalKey, step_id: stepId, updated_at: deps.now().toISOString() } as never)
    .eq('id', row.id)
    .select(COLUMNS)
    .single();
  if (error || !data) throw upstream('save the photo');
  const checked = await runCheck(deps, principal, data as unknown as PhotoRow);
  await awardIfEarned(deps, principal, checked);
  return json({ photo: toPhoto(checked) });
};

export const listPhotos: V2Body = async (request, deps) => {
  const params = new URL(request.url).searchParams;
  rejectBrowserIdentity(params);
  const principal = await requirePrincipal(request, deps);
  const raw = params.get('cursor');
  const cursor = raw ? decodeCursor(raw) : null;
  let query = createUserClient(deps.env, principal.accessToken)
    .from(T_PHOTOS)
    .select(COLUMNS)
    .eq('user_id', principal.userId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE + 1);
  if (cursor) query = query.or(`created_at.lt."${cursor.issuedDate}",and(created_at.eq."${cursor.issuedDate}",id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw upstream('load photos');
  const rows = data as unknown as PhotoRow[];
  const page = rows.slice(0, PAGE);
  const last = page.at(-1);
  return json({ photos: page.map(toPhoto), nextCursor: rows.length > PAGE && last ? encodeCursor(last.created_at, last.id) : null });
};

export const getPhotoUrl: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const row = await readPhoto(deps, principal, idParam(params));
  if (!row) throw new ApiError('not_found', 'Photo not found');
  if (row.status !== 'ready') throw new ApiError('validation', 'The photo is not uploaded yet');
  const url = await signedReadUrl(deps.env, principal.userId, row.object_key, READ_TTL_S);
  return json({ url, expiresAt: new Date(deps.now().getTime() + READ_TTL_S * 1000).toISOString() });
};
