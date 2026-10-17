// Browser client for FotoAI skills, weekly insights and photo critiques.
//
// Identity is never accepted as an input. The server derives the owner from
// the HttpOnly FotoAI session cookie on every request.

import type { PhotoCritique, SkillTreeResponse, WeeklyReport } from '../types.ts';
import { FotoaiClientError, type FotoaiFetch } from './client.ts';

/** A weekly report as the FotoAI API returns it (no owner id). */
export type FotoaiWeeklyReport = Omit<WeeklyReport, 'userId'>;

/** A photo critique as the FotoAI API returns it (no owner id; photoUrl is short-lived). */
export type FotoaiCritique = Omit<PhotoCritique, 'userId'>;

export interface CreateFotoaiCritiqueInput {
  photo?: File | null;
  submissionId?: string;
  challengeText?: string;
}

interface FotoaiErrorBody {
  error?: string;
  code?: string;
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

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapCritique(value: unknown): FotoaiCritique {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    id: String(row.id ?? ''),
    submissionId: typeof row.submissionId === 'string' ? row.submissionId : undefined,
    photoUrl: typeof row.photoUrl === 'string' ? row.photoUrl : '',
    technicalScore: numberOrZero(row.technicalScore),
    compositionScore: numberOrZero(row.compositionScore),
    creativeScore: numberOrZero(row.creativeScore),
    overallScore: numberOrZero(row.overallScore),
    technicalFeedback: String(row.technicalFeedback ?? ''),
    compositionFeedback: String(row.compositionFeedback ?? ''),
    creativeFeedback: String(row.creativeFeedback ?? ''),
    strengths: strings(row.strengths),
    improvements: strings(row.improvements),
    suggestedSettings: String(row.suggestedSettings ?? ''),
    critiqueDate: String(row.critiqueDate ?? ''),
  };
}

export async function getFotoaiSkillTree(fetcher: FotoaiFetch = fetch): Promise<SkillTreeResponse> {
  return requestJson<SkillTreeResponse>('/api/fotoai/skills', {}, fetcher);
}

export async function listFotoaiWeeklyReports(
  options: { limit?: number } = {},
  fetcher: FotoaiFetch = fetch,
): Promise<FotoaiWeeklyReport[]> {
  const query = options.limit !== undefined ? `?limit=${encodeURIComponent(String(options.limit))}` : '';
  const result = await requestJson<{ reports?: FotoaiWeeklyReport[] }>(`/api/fotoai/insights${query}`, {}, fetcher);
  return result.reports ?? [];
}

export async function listFotoaiCritiques(
  options: { submissionId?: string; limit?: number } = {},
  fetcher: FotoaiFetch = fetch,
): Promise<FotoaiCritique[]> {
  const params = new URLSearchParams();
  if (options.submissionId) params.set('submissionId', options.submissionId);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  const query = params.size ? `?${params.toString()}` : '';
  const result = await requestJson<{ critiques?: unknown[] }>(`/api/fotoai/critiques${query}`, {}, fetcher);
  return (result.critiques ?? []).map(mapCritique);
}

export async function getFotoaiCritique(critiqueId: string, fetcher: FotoaiFetch = fetch): Promise<FotoaiCritique> {
  const result = await requestJson<{ critique?: unknown }>(
    `/api/fotoai/critiques/${encodeURIComponent(critiqueId)}`,
    {},
    fetcher,
  );
  return mapCritique(result.critique);
}

export async function createFotoaiCritique(
  input: CreateFotoaiCritiqueInput,
  fetcher: FotoaiFetch = fetch,
): Promise<FotoaiCritique> {
  const form = new FormData();
  if (input.photo) form.append('photo', input.photo);
  if (input.submissionId) form.append('submissionId', input.submissionId);
  if (input.challengeText) form.append('challengeText', input.challengeText);
  const result = await requestJson<{ critique?: unknown }>(
    '/api/fotoai/critiques',
    { method: 'POST', body: form },
    fetcher,
  );
  return mapCritique(result.critique);
}
