// Browser client for the FotoAI vision features: reverse engineering, editing
// recipes and portfolio analysis. Identity is never sent; the server derives
// the owner from the HttpOnly FotoAI session cookie.

import type {
  EditingRecipe,
  PortfolioAnalysis,
  ReverseEngineeringResult,
} from '../types.ts';
import { FotoaiClientError, type FotoaiFetch } from './client.ts';

export interface FotoaiReverseAnalysis {
  id: string;
  /** Short-lived signed URL, or null when the photo cannot be shown. */
  photoUrl: string | null;
  result: ReverseEngineeringResult;
  analysisDate: string;
}

export interface FotoaiEditingRecipe {
  id: string;
  originalPhotoUrl: string | null;
  editedPhotoUrl: string | null;
  recipe: EditingRecipe;
  analysisDate: string;
}

export interface FotoaiPortfolioAnalysis {
  id: string;
  photoCount: number;
  analysis: PortfolioAnalysis;
  analysisDate: string;
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

function withLimit(path: string, limit?: number): string {
  return limit === undefined ? path : `${path}?limit=${encodeURIComponent(String(limit))}`;
}

// ----- reverse engineering ----------------------------------------------

export async function listFotoaiReverseAnalyses(limit?: number, fetcher?: FotoaiFetch): Promise<FotoaiReverseAnalysis[]> {
  const data = await requestJson<{ analyses?: FotoaiReverseAnalysis[] }>(withLimit('/api/fotoai/reverse', limit), {}, fetcher);
  return data.analyses ?? [];
}

export async function createFotoaiReverseAnalysis(photo: File, fetcher?: FotoaiFetch): Promise<FotoaiReverseAnalysis> {
  const form = new FormData();
  form.append('photo', photo);
  const data = await requestJson<{ analysis: FotoaiReverseAnalysis }>('/api/fotoai/reverse', { method: 'POST', body: form }, fetcher);
  return data.analysis;
}

// ----- editing recipes ---------------------------------------------------

export async function listFotoaiEditingRecipes(limit?: number, fetcher?: FotoaiFetch): Promise<FotoaiEditingRecipe[]> {
  const data = await requestJson<{ recipes?: FotoaiEditingRecipe[] }>(withLimit('/api/fotoai/editing', limit), {}, fetcher);
  return data.recipes ?? [];
}

export async function createFotoaiEditingRecipe(originalPhoto: File, editedPhoto: File, fetcher?: FotoaiFetch): Promise<FotoaiEditingRecipe> {
  const form = new FormData();
  form.append('originalPhoto', originalPhoto);
  form.append('editedPhoto', editedPhoto);
  const data = await requestJson<{ recipe: FotoaiEditingRecipe }>('/api/fotoai/editing', { method: 'POST', body: form }, fetcher);
  return data.recipe;
}

// ----- portfolio ---------------------------------------------------------

export async function listFotoaiPortfolioAnalyses(limit?: number, fetcher?: FotoaiFetch): Promise<FotoaiPortfolioAnalysis[]> {
  const data = await requestJson<{ analyses?: FotoaiPortfolioAnalysis[] }>(withLimit('/api/fotoai/portfolio', limit), {}, fetcher);
  return data.analyses ?? [];
}

export async function createFotoaiPortfolioAnalysis(photos: File[], fetcher?: FotoaiFetch): Promise<{ id: string; analysis: PortfolioAnalysis }> {
  const form = new FormData();
  photos.forEach((photo, i) => form.append(`photo_${i}`, photo));
  return requestJson<{ id: string; analysis: PortfolioAnalysis }>('/api/fotoai/portfolio', { method: 'POST', body: form }, fetcher);
}
