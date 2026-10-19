// v2 challenges: the active challenge, a paged list, one challenge's detail and status changes.
// Rows come through the user's own token (createUserClient), so RLS limits them to the owner.

import {
  CHALLENGE_STATUSES,
  ChallengeStatusPatch,
  type ChallengeDto,
  type ChallengeListResponse,
  type ChallengeSource,
  type ChallengeStatus,
} from '@fotoai/contracts';
import { canMove, CHALLENGE_MOVES, progressAfterCompletion } from '@fotoai/core';
import { createUserClient, type Database } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { ApiError, json, type V2Body } from './handler.ts';
import { readJsonObject } from './http.ts';
import { awardChallengeXp } from './privileged/xp.ts';

type ChallengeRow = Database['public']['Tables']['fotoai_daily_challenges']['Row'];

const TABLE = 'fotoai_daily_challenges';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
// Only the timestamp shape PostgREST returns; it is interpolated into an or() filter.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const opt = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Same mapping as the live app's toChallengeDto, plus source. */
export function toV2Challenge(row: ChallengeRow): ChallengeDto {
  return {
    id: row.id,
    challengeType: row.challenge_type,
    challengeText: row.challenge_text,
    category: row.category ?? 'General',
    difficulty: row.difficulty ?? 'Not set',
    duration: opt(row.duration) ?? '',
    tips: opt(row.tips) ?? '',
    recommendedGear: strings(row.recommended_gear),
    weatherConditions: opt(row.weather_conditions),
    location: opt(row.location),
    status: row.status as ChallengeStatus,
    issuedDate: row.issued_date,
    completedDate: row.completed_date ?? null,
    shotList: strings(row.shot_list),
    narrativeContext: opt(row.narrative_context),
    editingDirection: opt(row.editing_direction),
    masteryArea: opt(row.mastery_area),
    technicalLevel: typeof row.technical_level === 'number' ? row.technical_level : undefined,
    successCriteria: opt(row.success_criteria),
    whatToLookFor: opt(row.what_to_look_for),
    source: row.source as ChallengeSource,
  };
}

export function encodeCursor(issuedDate: string, id: string): string {
  return Buffer.from(`${issuedDate}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { issuedDate: string; id: string } {
  const invalid = () => new ApiError('validation', 'Invalid cursor');
  if (!BASE64URL.test(cursor)) throw invalid();
  const [issuedDate, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (rest.length > 0 || !issuedDate || !id || !ISO_TIMESTAMP.test(issuedDate) || Number.isNaN(Date.parse(issuedDate)) || !UUID.test(id)) {
    throw invalid();
  }
  return { issuedDate, id };
}

export function parseListQuery(params: URLSearchParams): {
  status: ChallengeStatus | 'all';
  limit: number;
  cursor: { issuedDate: string; id: string } | null;
} {
  const status = params.get('status') ?? 'all';
  if (status !== 'all' && !(CHALLENGE_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError('validation', `status must be one of all, ${CHALLENGE_STATUSES.join(', ')}`);
  }
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? DEFAULT_LIMIT : /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ApiError('validation', `limit must be between 1 and ${MAX_LIMIT}`);
  }
  const rawCursor = params.get('cursor');
  return { status: status as ChallengeStatus | 'all', limit, cursor: rawCursor ? decodeCursor(rawCursor) : null };
}

const loadFailed = () => new ApiError('upstream', 'Could not load challenges');

export const getActiveChallenge: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(TABLE)
    .select('*')
    .in('status', ['pending', 'accepted'])
    .order('issued_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw loadFailed();
  const row = data?.[0];
  return json({ challenge: row ? toV2Challenge(row) : null });
};

export const listChallenges: V2Body = async (request, deps) => {
  const params = new URL(request.url).searchParams;
  rejectBrowserIdentity(params);
  const principal = await requirePrincipal(request, deps);
  const { status, limit, cursor } = parseListQuery(params);

  let query = createUserClient(deps.env, principal.accessToken).from(TABLE).select('*');
  if (status !== 'all') query = query.eq('status', status);
  if (cursor) {
    query = query.or(`issued_date.lt."${cursor.issuedDate}",and(issued_date.eq."${cursor.issuedDate}",id.lt.${cursor.id})`);
  }
  const { data, error } = await query
    .order('issued_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (error) throw loadFailed();

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const body: ChallengeListResponse = {
    challenges: page.map(toV2Challenge),
    nextCursor: rows.length > limit && last ? encodeCursor(last.issued_date, last.id) : null,
  };
  return json(body);
};

export const getChallenge: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Challenge id must be a UUID');
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw loadFailed();
  if (!data) throw new ApiError('not_found', 'Challenge not found');
  return json({ challenge: toV2Challenge(data) });
};

type UserClient = ReturnType<typeof createUserClient>;
type Target = ChallengeStatusPatch['status'];

async function readOwnChallenge(client: UserClient, id: string): Promise<ChallengeRow> {
  const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw loadFailed();
  if (!data) throw new ApiError('not_found', 'Challenge not found');
  return data;
}

const cannotMove = (from: string, to: Target) => new ApiError('validation', `A ${from} challenge cannot move to ${to}`);

/** The statuses a challenge may be in for an update to `to` to be allowed. */
const sourcesOf = (to: Target) => Object.entries(CHALLENGE_MOVES).filter(([, moves]) => moves.includes(to)).map(([from]) => from);

/** One completion on the caller's progress row (user token, as the live app does). */
async function recordCompletion(client: UserClient, principal: Principal, challenge: ChallengeRow, now: Date): Promise<void> {
  const failed = () => new ApiError('upstream', 'Could not update progress');
  const found = await client.from('fotoai_user_progress').select('*').maybeSingle();
  if (found.error) throw failed();
  let progress = found.data;
  if (!progress) {
    const made = await client.from('fotoai_user_progress').insert({ user_id: principal.userId }).select('*').single();
    if (made.error || !made.data) throw failed();
    progress = made.data;
  }
  const { error } = await client
    .from('fotoai_user_progress')
    .update(progressAfterCompletion(progress, challenge.challenge_type, now) as never)
    .eq('id', progress.id);
  if (error) throw failed();
}

/**
 * PATCH /api/v2/challenges/:id { status }. The update only runs where the current status may move
 * to the new one, so a completion counts once even when two requests race. Repeating the current
 * status is a 200 with changed: false; a repeated completion also re-sends the XP award, which
 * the award function turns into a duplicate (so an award lost to an error is not lost for good).
 */
export const patchChallenge: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const rawId = params.id ?? '';
  if (!UUID.test(rawId)) throw new ApiError('validation', 'Challenge id must be a UUID');
  const id = rawId.toLowerCase();
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = ChallengeStatusPatch.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', 'status must be accepted, skipped or completed');
  const to = parsed.data.status;

  const client = createUserClient(deps.env, principal.accessToken);
  const unchanged = async (row: ChallengeRow) => {
    if (to === 'completed') await awardChallengeXp(deps.env, principal.userId, row);
    return json({ challenge: toV2Challenge(row), changed: false });
  };

  const current = await readOwnChallenge(client, id);
  if (current.status === to) return unchanged(current);
  if (!canMove(current.status, to)) throw cannotMove(current.status, to);

  const now = deps.now();
  const { data, error } = await client
    .from(TABLE)
    .update(to === 'completed' ? { status: to, completed_date: now.toISOString() } : { status: to })
    .eq('id', id)
    .in('status', sourcesOf(to))
    .select('*');
  if (error) throw new ApiError('upstream', 'Could not save the challenge');
  const row = data?.[0];
  if (!row) {
    // Another request moved it first: answer as if this one came second.
    const again = await readOwnChallenge(client, id);
    if (again.status === to) return unchanged(again);
    throw cannotMove(again.status, to);
  }

  if (to === 'completed') {
    await recordCompletion(client, principal, row, now);
    await awardChallengeXp(deps.env, principal.userId, row);
  }
  return json({ challenge: toV2Challenge(row), changed: true });
};
