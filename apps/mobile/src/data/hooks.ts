// One hook per v2 endpoint. Reads parse with their contract schema (a mismatch is an error, never
// data); each write updates or invalidates exactly the reads it changes.

import {
  type SpotDto,
  type SpotInput,
  type SpotPatch,
  ActiveChallengeResponse,
  GenerateChallengeResponse,
  MeResponse,
  Preferences,
  ProgressResponse,
  type AddGearInput,
  type ChallengeStatusPatch,
  type GenerateChallengeInput,
  type LoadoutInput,
  type PreferencesPatch,
} from '@fotoai/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { ApiClientError } from '../lib/api';

import { getApi } from './client';
import { keys } from './keys';
import {
  CatalogResponse,
  ChallengeChangeResponse,
  ChallengeResponse,
  ConditionsResponse,
  ExplanationResponse,
  GearItemResponse,
  LoadoutResponse,
  MyGearResponse,
  OkResponse,
  PlacePhotoResponse,
  PlaceResponse,
  PlacesResponse,
  SpotResponse,
  SpotsResponse,
} from './schemas';

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => getApi().request('/api/v2/me', { schema: MeResponse }) });

export const useProgress = () =>
  useQuery({ queryKey: keys.progress, queryFn: () => getApi().request('/api/v2/me/progress', { schema: ProgressResponse }) });

export const usePreferences = () =>
  useQuery({ queryKey: keys.preferences, queryFn: () => getApi().request('/api/v2/me/preferences', { schema: Preferences }) });

export function usePatchPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: PreferencesPatch) => getApi().request('/api/v2/me/preferences', { schema: Preferences, method: 'PATCH', body: patch }),
    // Only the fields this request sent: an older answer to another save cannot undo them.
    onSuccess: (prefs, patch) =>
      client.setQueryData<Preferences>(keys.preferences, (old) => {
        if (!old) return prefs;
        const sent = Object.keys(patch) as Array<keyof Preferences>;
        return { ...old, ...Object.fromEntries(sent.map((k) => [k, prefs[k]])) };
      }),
  });
}

export const useGearCatalog = () =>
  useQuery({ queryKey: keys.catalog, staleTime: 24 * 60 * 60 * 1000, queryFn: () => getApi().request('/api/v2/gear/catalog', { schema: CatalogResponse }) });

export const useMyGear = () => useQuery({ queryKey: keys.myGear, queryFn: () => getApi().request('/api/v2/me/gear', { schema: MyGearResponse }) });

export function useAddGear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AddGearInput) => getApi().request('/api/v2/me/gear', { schema: GearItemResponse, method: 'POST', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.myGear }),
  });
}

export function useDeleteGear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getApi().request(`/api/v2/me/gear/${encodeURIComponent(id)}`, { schema: OkResponse, method: 'DELETE' }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: keys.myGear }), client.invalidateQueries({ queryKey: keys.loadout })]),
  });
}

export const useLoadout = () => useQuery({ queryKey: keys.loadout, queryFn: () => getApi().request('/api/v2/me/loadout', { schema: LoadoutResponse }) });

export function usePutLoadout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoadoutInput) => getApi().request('/api/v2/me/loadout', { schema: LoadoutResponse, method: 'PUT', body: input }),
    onSuccess: (answer) => client.setQueryData(keys.loadout, answer),
  });
}

export const useSpots = () => useQuery({ queryKey: keys.spots, queryFn: () => getApi().request('/api/v2/me/spots', { schema: SpotsResponse }) });

/** `day` is the phone's date (YYYY-MM-DD): a new day is a new answer. */
export function useConditions(at: { lat: number; lng: number } | null, day: string) {
  return useQuery({
    queryKey: at ? keys.conditions(at, day) : ['conditions', 'none'],
    enabled: at !== null,
    staleTime: 10 * 60 * 1000,
    queryFn: () => getApi().request(`/api/v2/conditions?lat=${at!.lat.toFixed(4)}&lng=${at!.lng.toFixed(4)}`, { schema: ConditionsResponse }),
  });
}

export const useActiveChallenge = () =>
  useQuery({ queryKey: keys.activeChallenge, queryFn: () => getApi().request('/api/v2/challenges/active', { schema: ActiveChallengeResponse }) });

export const useChallenge = (id: string) =>
  useQuery({ queryKey: keys.challenge(id), queryFn: () => getApi().request(`/api/v2/challenges/${encodeURIComponent(id)}`, { schema: ChallengeResponse }) });

export function useNewChallenge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateChallengeInput = {}) => getApi().request('/api/v2/challenges', { schema: GenerateChallengeResponse, method: 'POST', body: input }),
    onSuccess: (answer) => {
      client.setQueryData(keys.activeChallenge, { challenge: answer.challenge });
      return client.invalidateQueries({ queryKey: keys.progress });
    },
  });
}

export function usePatchChallenge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string } & ChallengeStatusPatch) =>
      getApi().request(`/api/v2/challenges/${encodeURIComponent(id)}`, { schema: ChallengeChangeResponse, method: 'PATCH', body: { status } }),
    onSuccess: (answer) => {
      client.setQueryData(keys.challenge(answer.challenge.id), { challenge: answer.challenge });
      return Promise.all([client.invalidateQueries({ queryKey: keys.activeChallenge }), client.invalidateQueries({ queryKey: keys.progress })]);
    },
  });
}

// --- Explore (3D). Places answers are never saved on the phone (Google terms): `meta.save: false`.

const FRESH_ONLY = { save: false } as const;
// The server reserves the hourly limit before calling Google or the AI, so a retry uses it again:
// retry only when the request never left the phone.
const offlineOnly = (count: number, error: unknown) => error instanceof ApiClientError && error.code === 'offline' && count < 2;
const coords = (at: { lat: number; lng: number }) => `lat=${at.lat.toFixed(4)}&lng=${at.lng.toFixed(4)}`;

/** True when the server says a feature is not set up yet (a missing key): show "unavailable", not an error. */
export const isNotSetUp = (error: unknown) => error instanceof ApiClientError && error.code === 'config';

export function useNearby(at: { lat: number; lng: number } | null, type: string | null = null) {
  return useQuery({
    queryKey: at ? keys.nearby(at, type) : ['explore', 'nearby', 'none'],
    enabled: at !== null,
    meta: FRESH_ONLY,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getApi().request(`/api/v2/explore/nearby?${coords(at!)}${type ? `&type=${type}` : ''}`, { schema: PlacesResponse }),
  });
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Text search near `at`, after 2 characters and a 400 ms pause in typing. */
export function useSearch(text: string, at: { lat: number; lng: number } | null) {
  const q = useDebounced(text.trim(), 400);
  return useQuery({
    queryKey: keys.search(q, at),
    enabled: q.length >= 2,
    meta: FRESH_ONLY,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getApi().request(`/api/v2/explore/search?q=${encodeURIComponent(q)}${at ? `&${coords(at)}` : ''}`, { schema: PlacesResponse }),
  });
}

export const usePlace = (placeId: string) =>
  useQuery({
    queryKey: keys.place(placeId),
    meta: FRESH_ONLY,
    queryFn: () => getApi().request(`/api/v2/places/${encodeURIComponent(placeId)}`, { schema: PlaceResponse }),
  });

/** One photo's short-lived link; kept 30 minutes in memory only (30 photos an hour per user). */
export function usePlacePhoto(placeId: string, name: string | null, maxPx = 800) {
  return useQuery({
    queryKey: keys.placePhoto(placeId, name ?? ''),
    enabled: name !== null,
    meta: FRESH_ONLY,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: offlineOnly,
    queryFn: () =>
      getApi().request(`/api/v2/places/${encodeURIComponent(placeId)}/photo?name=${encodeURIComponent(name!)}&maxPx=${maxPx}`, { schema: PlacePhotoResponse }),
  });
}

/** An AI explanation that runs only after `ask()` (it costs an AI call). */
function useAskedExplain(key: readonly unknown[], path: string) {
  const [asked, setAsked] = useState(false);
  const query = useQuery({
    queryKey: key,
    enabled: asked,
    meta: FRESH_ONLY,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: offlineOnly,
    queryFn: () => getApi().request(path, { schema: ExplanationResponse }),
  });
  const ask = useCallback(() => setAsked(true), []);
  return { ...query, asked, ask };
}

export const useExplainPlace = (placeId: string) => useAskedExplain(keys.explainPlace(placeId), `/api/v2/places/${encodeURIComponent(placeId)}/explain`);
export const useExplainSpot = (spotId: string) => useAskedExplain(keys.explainSpot(spotId), `/api/v2/me/spots/${encodeURIComponent(spotId)}/explain`);

type SpotList = { spots: SpotDto[] };

/**
 * A spot write updates the cached list with the server's answer. Refetching the whole list would
 * cost one Google call per saved Google spot, so it is never done for a write. The place screens
 * (which show "saved or not") are refreshed.
 */
function useSpotsWrite() {
  const client = useQueryClient();
  return (change: (spots: SpotDto[]) => SpotDto[]) => {
    client.setQueryData<SpotList>(keys.spots, (old) => (old ? { spots: change(old.spots) } : old));
    return client.invalidateQueries({ queryKey: ['explore', 'place'] });
  };
}

export function useAddSpot() {
  const write = useSpotsWrite();
  return useMutation({
    mutationFn: (input: SpotInput) => getApi().request('/api/v2/me/spots', { schema: SpotResponse, method: 'POST', body: input }),
    onSuccess: ({ spot }) => write((spots) => [...spots.filter((s) => s.id !== spot.id), spot]),
  });
}

export function useUpdateSpot() {
  const write = useSpotsWrite();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SpotPatch }) =>
      getApi().request(`/api/v2/me/spots/${encodeURIComponent(id)}`, { schema: SpotResponse, method: 'PATCH', body: patch }),
    onSuccess: ({ spot }) => write((spots) => spots.map((s) => (s.id === spot.id ? spot : s))),
  });
}

export function useDeleteSpot() {
  const write = useSpotsWrite();
  return useMutation({
    mutationFn: (id: string) => getApi().request(`/api/v2/me/spots/${encodeURIComponent(id)}`, { schema: OkResponse, method: 'DELETE' }),
    onSuccess: (_answer, id) => write((spots) => spots.filter((s) => s.id !== id)),
  });
}
