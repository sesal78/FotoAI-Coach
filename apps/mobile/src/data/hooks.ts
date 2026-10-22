// One hook per v2 endpoint. Reads parse with their contract schema (a mismatch is an error, never
// data); each write updates or invalidates exactly the reads it changes.

import {
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

import { getApi } from './client';
import { keys } from './keys';
import {
  CatalogResponse,
  ChallengeChangeResponse,
  ChallengeResponse,
  ConditionsResponse,
  GearItemResponse,
  LoadoutResponse,
  MyGearResponse,
  OkResponse,
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
    onSuccess: (prefs) => client.setQueryData(keys.preferences, prefs),
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

export function useConditions(at: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: at ? keys.conditions(at) : ['conditions', 'none'],
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
