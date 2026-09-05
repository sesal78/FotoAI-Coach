// Browser client for the FotoAI core path.
//
// Identity is never accepted as an input. The server derives the owner from
// the HttpOnly FotoAI session cookie on every request.

import type { Challenge, UserProgress } from '../types.ts';

export type FotoaiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface FotoaiUser {
  id: string;
  email: string;
  name: string;
}

export interface SubmitFotoaiChallengeInput {
  challengeId: string;
  notes: string;
  rating?: number;
  photo?: File | null;
}

export type FotoaiSkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';
export type FotoaiGearCategory = 'camera' | 'lens' | 'tripod' | 'light' | 'other';

export interface FotoaiPreferences {
  skillLevel: FotoaiSkillLevel;
  photographyInterests: string[];
  homeLocation: string | null;
  currentLocation: string | null;
}

export interface FotoaiGear {
  id: string;
  category: FotoaiGearCategory;
  brand: string;
  model: string;
}

export interface CreateFotoaiGearInput {
  category: FotoaiGearCategory;
  brand: string;
  model: string;
}

interface FotoaiErrorBody {
  error?: string;
  code?: string;
}

export class FotoaiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = 'FotoaiClientError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  fetcher: FotoaiFetch = fetch,
): Promise<T> {
  const response = await fetcher(path, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({})) as T & FotoaiErrorBody;
  if (!response.ok) {
    throw new FotoaiClientError(
      data.error || `FotoAI request failed (${response.status})`,
      response.status,
      data.code,
    );
  }
  return data;
}

function jsonBody(value: Record<string, unknown>): Pick<RequestInit, 'headers' | 'body'> {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapChallenge(row: Record<string, unknown>): Challenge {
  return {
    id: String(row.id ?? ''),
    challengeText: String(row.challenge_text ?? ''),
    category: String(row.category ?? row.challenge_type ?? 'General'),
    difficulty: String(row.difficulty ?? 'Not set'),
    duration: String(row.duration ?? ''),
    tips: String(row.tips ?? ''),
    recommendedGear: strings(row.recommended_gear),
    weatherConditions: typeof row.weather_conditions === 'string' ? row.weather_conditions : undefined,
    location: typeof row.location === 'string' ? row.location : undefined,
    status: String(row.status ?? ''),
    issuedDate: String(row.issued_date ?? ''),
    submissions: Array.isArray(row.submissions) ? row.submissions : undefined,
    shotList: strings(row.shot_list),
    narrativeContext: typeof row.narrative_context === 'string' ? row.narrative_context : undefined,
    editingDirection: typeof row.editing_direction === 'string' ? row.editing_direction : undefined,
    masteryArea: typeof row.mastery_area === 'string' ? row.mastery_area : undefined,
    technicalLevel: typeof row.technical_level === 'number' ? row.technical_level : undefined,
    successCriteria: typeof row.success_criteria === 'string' ? row.success_criteria : undefined,
    whatToLookFor: typeof row.what_to_look_for === 'string' ? row.what_to_look_for : undefined,
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapProgress(row: Record<string, unknown>): UserProgress {
  return {
    totalChallengesCompleted: numberOrZero(row.total_challenges_completed),
    totalChallengesIssued: numberOrZero(row.total_challenges_issued),
    currentStreak: numberOrZero(row.current_streak),
    longestStreak: numberOrZero(row.longest_streak),
    completionRate: numberOrZero(row.completionRate),
    favoriteSubjects: strings(row.favorite_subjects),
  };
}

function mapPreferences(value: unknown): FotoaiPreferences {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const skillLevel = ['beginner', 'intermediate', 'advanced', 'professional'].includes(String(row.skillLevel))
    ? row.skillLevel as FotoaiSkillLevel
    : 'intermediate';
  const location = (item: unknown) => typeof item === 'string' ? item : null;
  return {
    skillLevel,
    photographyInterests: strings(row.photographyInterests),
    homeLocation: location(row.homeLocation),
    currentLocation: location(row.currentLocation),
  };
}

function mapGear(value: unknown): FotoaiGear {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const category = ['camera', 'lens', 'tripod', 'light', 'other'].includes(String(row.category))
    ? row.category as FotoaiGearCategory
    : 'other';
  return {
    id: String(row.id ?? ''),
    category,
    brand: String(row.brand ?? ''),
    model: String(row.model ?? ''),
  };
}

export async function loginFotoai(
  email: string,
  password: string,
  fetcher: FotoaiFetch = fetch,
): Promise<void> {
  await requestJson('/api/fotoai/auth/login', {
    method: 'POST',
    ...jsonBody({ email, password }),
  }, fetcher);
}

export async function getFotoaiSession(fetcher: FotoaiFetch = fetch): Promise<FotoaiUser> {
  const user = await requestJson<{ id: string; email: string; name?: string | null }>(
    '/api/fotoai/auth/me',
    {},
    fetcher,
  );
  const fallbackName = user.email.split('@')[0] || 'Photographer';
  return { id: user.id, email: user.email, name: user.name || fallbackName };
}

export async function logoutFotoai(fetcher: FotoaiFetch = fetch): Promise<void> {
  await requestJson('/api/fotoai/auth/logout', { method: 'POST' }, fetcher);
}

export async function registerFotoai(
  email: string,
  password: string,
  name: string,
  fetcher: FotoaiFetch = fetch,
): Promise<{ confirmationRequired: boolean }> {
  const result = await requestJson<{ confirmationRequired?: boolean }>(
    '/api/fotoai/auth/register',
    { method: 'POST', ...jsonBody({ email, password, name }) },
    fetcher,
  );
  return { confirmationRequired: result.confirmationRequired === true };
}

export async function getFotoaiPreferences(fetcher: FotoaiFetch = fetch): Promise<FotoaiPreferences> {
  const result = await requestJson<{ preferences?: unknown }>('/api/fotoai/preferences', {}, fetcher);
  return mapPreferences(result.preferences);
}

export async function saveFotoaiPreferences(
  input: Partial<FotoaiPreferences>,
  fetcher: FotoaiFetch = fetch,
): Promise<FotoaiPreferences> {
  const result = await requestJson<{ preferences?: unknown }>('/api/fotoai/preferences', {
    method: 'PUT',
    ...jsonBody(input as Record<string, unknown>),
  }, fetcher);
  return mapPreferences(result.preferences);
}

export async function listFotoaiGear(fetcher: FotoaiFetch = fetch): Promise<FotoaiGear[]> {
  const result = await requestJson<{ gear?: unknown[] }>('/api/fotoai/gear', {}, fetcher);
  return (result.gear ?? []).map(mapGear);
}

export async function createFotoaiGear(
  input: CreateFotoaiGearInput,
  fetcher: FotoaiFetch = fetch,
): Promise<FotoaiGear> {
  const result = await requestJson<{ gear?: unknown }>('/api/fotoai/gear', {
    method: 'POST',
    ...jsonBody(input as unknown as Record<string, unknown>),
  }, fetcher);
  return mapGear(result.gear);
}

export async function deleteFotoaiGear(gearId: string, fetcher: FotoaiFetch = fetch): Promise<void> {
  await requestJson(`/api/fotoai/gear/${encodeURIComponent(gearId)}`, { method: 'DELETE' }, fetcher);
}

export async function listFotoaiChallenges(
  options: { status?: 'pending' | 'accepted' | 'skipped' | 'completed' | 'all'; limit?: number } = {},
  fetcher: FotoaiFetch = fetch,
): Promise<Challenge[]> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  const query = params.size ? `?${params.toString()}` : '';
  const result = await requestJson<{ challenges?: Record<string, unknown>[] }>(
    `/api/fotoai/challenges${query}`,
    {},
    fetcher,
  );
  return (result.challenges ?? []).map(mapChallenge);
}

export async function getFotoaiProgress(fetcher: FotoaiFetch = fetch): Promise<UserProgress> {
  const result = await requestJson<{ progress: Record<string, unknown> }>(
    '/api/fotoai/progress',
    {},
    fetcher,
  );
  return mapProgress(result.progress);
}

export async function submitFotoaiChallenge(
  input: SubmitFotoaiChallengeInput,
  fetcher: FotoaiFetch = fetch,
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('challengeId', input.challengeId);
  form.append('notes', input.notes);
  if (input.rating !== undefined && input.rating >= 1 && input.rating <= 5) {
    form.append('rating', String(input.rating));
  }
  if (input.photo) form.append('photo', input.photo);

  const result = await requestJson<{ submission: Record<string, unknown> }>(
    '/api/fotoai/submissions',
    { method: 'POST', body: form },
    fetcher,
  );
  return result.submission;
}

export async function updateFotoaiChallengeStatus(
  challengeId: string,
  status: 'accepted' | 'skipped' | 'completed',
  fetcher: FotoaiFetch = fetch,
): Promise<Challenge> {
  const result = await requestJson<{ challenge: Record<string, unknown> }>(
    `/api/fotoai/challenges/${encodeURIComponent(challengeId)}`,
    { method: 'PATCH', ...jsonBody({ status }) },
    fetcher,
  );
  return mapChallenge(result.challenge);
}
