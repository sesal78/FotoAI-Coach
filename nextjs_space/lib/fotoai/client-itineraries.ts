// Browser client for FotoAI itineraries. Identity comes from the session cookie.

import { FotoaiClientError, type FotoaiFetch } from './client.ts';

export interface FotoaiItinerarySpot {
  name: string;
  location: string;
  bestTime: string;
  photoOpportunities: string[];
  tips: string;
}

export interface FotoaiItinerary {
  id: string;
  location: string;
  title: string;
  description: string;
  spots: FotoaiItinerarySpot[];
  suggestedTimes: string[];
  weatherConditions: string | null;
  gearRecommendations: string[];
  duration: string | null;
  status: string;
  generatedDate: string;
}

async function requestJson<T>(path: string, init: RequestInit = {}, fetcher: FotoaiFetch = fetch): Promise<T> {
  const response = await fetcher(path, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({})) as T & { error?: string; code?: string };
  if (!response.ok) {
    throw new FotoaiClientError(data.error || `FotoAI request failed (${response.status})`, response.status, data.code);
  }
  return data;
}

export async function listFotoaiItineraries(
  options: { limit?: number } = {},
  fetcher: FotoaiFetch = fetch,
): Promise<FotoaiItinerary[]> {
  const query = options.limit !== undefined ? `?limit=${encodeURIComponent(String(options.limit))}` : '';
  const result = await requestJson<{ itineraries?: FotoaiItinerary[] }>(`/api/fotoai/itineraries${query}`, {}, fetcher);
  return result.itineraries ?? [];
}

export async function createFotoaiItinerary(
  input: { location: string; duration?: string },
  fetcher: FotoaiFetch = fetch,
): Promise<{ itinerary: FotoaiItinerary; message: string }> {
  return requestJson('/api/fotoai/itineraries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: input.location, duration: input.duration }),
  }, fetcher);
}
