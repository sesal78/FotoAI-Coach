// v2 Analyse: a critique, editing tips or how to recreate one of the caller's ready photos, and
// the list of a photo's analyses. A photo is analysed only once its AI check says it is safe (a
// photo never checked is checked first). The model sees the photo through a 120-second signed
// read link; the answer is stored with the user's token as one fotoai_photo_critiques row. Only a
// critique earns XP, once per photo (privileged/xp.ts).

import { analysePhoto as runAnalysis, type Analysis } from '@fotoai/ai';
import { AnalyseInput, EditingDto, RecreateDto, type AnalysisDto } from '@fotoai/contracts';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { describeLoadout, loadSavedLoadout } from './gear.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { readJsonObject } from './http.ts';
import { ensureChecked, readPhoto, type PhotoRow } from './photos.ts';
import { fromAi, requireAi } from './plans.ts';
import { signedReadUrl } from './privileged/storage.ts';
import { awardCritiqueXp } from './privileged/xp.ts';
import { reserveCalls } from './rate-limit.ts';

const T_ANALYSES = 'fotoai_photo_critiques';
const COLUMNS =
  'id, photo_id, mode, details, created_at, technical_score, composition_score, creative_score, overall_score, technical_feedback, composition_feedback, creative_feedback, strengths, improvements, suggested_settings';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ_TTL_S = 120;
const PAGE = 50;

type AnalysisRow = {
  id: string;
  photo_id: string;
  mode: 'critique' | 'editing' | 'recreate';
  details: unknown;
  created_at: string;
  technical_score: number | null;
  composition_score: number | null;
  creative_score: number | null;
  overall_score: number | null;
  technical_feedback: string | null;
  composition_feedback: string | null;
  creative_feedback: string | null;
  strengths: string[];
  improvements: string[];
  suggested_settings: string | null;
};

const upstream = (what: string) => new ApiError('upstream', `Could not ${what}`);
const num = (v: number | string | null) => (v === null ? null : Number(v));

/** The row as a DTO, or null when stored details do not have the right shape (a row written by hand). */
function toAnalysis(row: AnalysisRow): AnalysisDto | null {
  const base = { id: row.id, photoId: row.photo_id, createdAt: row.created_at };
  if (row.mode === 'editing') {
    const editing = EditingDto.safeParse(row.details);
    return editing.success ? { ...base, mode: 'editing', editing: editing.data } : null;
  }
  if (row.mode === 'recreate') {
    const recreate = RecreateDto.safeParse(row.details);
    return recreate.success ? { ...base, mode: 'recreate', recreate: recreate.data } : null;
  }
  return {
    ...base,
    mode: 'critique',
    critique: {
      technicalScore: row.technical_score ?? 0,
      compositionScore: row.composition_score ?? 0,
      creativeScore: row.creative_score ?? 0,
      overallScore: row.overall_score ?? 0,
      technicalFeedback: row.technical_feedback ?? '',
      compositionFeedback: row.composition_feedback ?? '',
      creativeFeedback: row.creative_feedback ?? '',
      strengths: row.strengths,
      improvements: row.improvements,
      suggestedSettings: row.suggested_settings,
    },
  };
}

function photoId(params: Record<string, string>): string {
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Photo id must be a UUID');
  return id.toLowerCase();
}

async function readyPhoto(deps: V2Deps, principal: Principal, id: string): Promise<PhotoRow> {
  const row = await readPhoto(deps, principal, id);
  if (!row || row.status !== 'ready') throw new ApiError('not_found', 'Photo not found');
  return row;
}

/** What the model may know: the skill level, the loadout, the photo's EXIF and its step's brief. */
async function loadContext(deps: V2Deps, principal: Principal, photo: PhotoRow) {
  const client = createUserClient(deps.env, principal.accessToken);
  const [prefs, loadout, step] = await Promise.all([
    client.from('fotoai_user_preferences').select('skill_level').maybeSingle(),
    loadSavedLoadout(deps, principal),
    photo.step_id ? client.from('fotoai_plan_steps').select('title, instruction').eq('id', photo.step_id).maybeSingle() : null,
  ]);
  if (prefs.error || step?.error) throw upstream('load the photo context');
  return {
    skillLevel: prefs.data?.skill_level ?? 'intermediate',
    loadout: loadout ? describeLoadout(loadout) : null,
    exif: {
      cameraMake: photo.camera_make,
      cameraModel: photo.camera_model,
      lensModel: photo.lens_model,
      focalMm: num(photo.focal_mm),
      aperture: num(photo.aperture),
      shutterS: num(photo.shutter_s),
      iso: photo.iso,
      takenAt: photo.taken_at,
    },
    brief: step?.data ?? null,
  };
}

function columnsFor(result: Analysis): Record<string, unknown> {
  if (result.mode !== 'critique') return { details: result.mode === 'editing' ? result.editing : result.recreate };
  const c = result.critique;
  return {
    technical_score: c.technicalScore,
    composition_score: c.compositionScore,
    creative_score: c.creativeScore,
    overall_score: c.overallScore,
    technical_feedback: c.technicalFeedback,
    composition_feedback: c.compositionFeedback,
    creative_feedback: c.creativeFeedback,
    strengths: c.strengths,
    improvements: c.improvements,
    suggested_settings: c.suggestedSettings,
  };
}

/**
 * Critique XP only for a photo's first critique, so re-running a critique for better scores, or
 * two at once, never earns more. The analysis is already saved, so a failure is logged, not thrown.
 */
async function awardFirstCritique(deps: V2Deps, principal: Principal, photoId: string, c: { technicalScore: number; compositionScore: number; creativeScore: number }) {
  try {
    const { count, error } = await createUserClient(deps.env, principal.accessToken)
      .from(T_ANALYSES)
      .select('id', { count: 'exact', head: true })
      .eq('photo_id', photoId)
      .eq('mode', 'critique');
    if (error || count !== 1) return;
    await awardCritiqueXp(deps.env, principal.userId, photoId, { technical: c.technicalScore, composition: c.compositionScore, creative: c.creativeScore });
  } catch {
    console.warn('FotoAI v2: analysis saved but the critique XP was not awarded');
  }
}

/** POST /api/v2/photos/:id/analyse { mode } → 201 { analysis }. */
export const analysePhoto: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = photoId(params);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = AnalyseInput.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', 'mode must be critique, editing or recreate');
  requireAi(deps);
  await reserveCalls(deps.env, principal, 'photo_analyse', 1, deps.now());

  const photo = await ensureChecked(deps, principal, await readyPhoto(deps, principal, id));
  if (!photo.checked_at) throw new ApiError('upstream', 'Could not check the photo. Please try again.');
  if (photo.check_safe !== true) throw new ApiError('validation', 'This photo cannot be analysed');

  const context = await loadContext(deps, principal, photo);
  const url = await signedReadUrl(deps.env, principal.userId, photo.object_key, READ_TTL_S);
  let result: Analysis;
  try {
    result = await runAnalysis(deps.ai, parsed.data.mode, context, new URL(url));
  } catch (err) {
    throw fromAi(err);
  }

  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_ANALYSES)
    .insert({
      user_id: principal.userId,
      photo_id: photo.id,
      mode: result.mode,
      photo_object_key: photo.object_key,
      critique_date: deps.now().toISOString(),
      ...columnsFor(result),
    } as never)
    .select(COLUMNS)
    .single();
  if (error || !data) throw upstream('save the analysis');
  if (result.mode === 'critique') await awardFirstCritique(deps, principal, photo.id, result.critique);
  return json({ analysis: toAnalysis(data as unknown as AnalysisRow) }, { status: 201 });
};

/** GET /api/v2/photos/:id/analyses → { analyses }, newest first. */
export const listPhotoAnalyses: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = photoId(params);
  if (!(await readPhoto(deps, principal, id))) throw new ApiError('not_found', 'Photo not found');
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_ANALYSES)
    .select(COLUMNS)
    .eq('photo_id', id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE);
  if (error) throw upstream('load the analyses');
  return json({ analyses: (data as unknown as AnalysisRow[]).map(toAnalysis).filter((a): a is AnalysisDto => a !== null) });
};
