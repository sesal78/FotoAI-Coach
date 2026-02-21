'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Challenge, UserProgress } from '@/lib/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function readLocalStorageChallenge(): Challenge | undefined {
  try {
    const raw = localStorage.getItem('currentChallenge');
    return raw ? (JSON.parse(raw) as Challenge) : undefined;
  } catch {
    return undefined;
  }
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetches the single pending challenge for the current user.
 * Falls back to localStorage if the server hasn't responded yet.
 * On success the challenge is persisted to localStorage for offline use.
 */
export function usePendingChallenge(userId: string | undefined) {
  return useQuery<Challenge | null>({
    queryKey: ['challenges', 'pending', userId],
    queryFn: async () => {
      const res = await fetch(
        `/api/challenges?userId=${userId}&status=pending&limit=1`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`Failed to fetch pending challenge (${res.status})`);
      const data = await res.json();
      const challenge: Challenge | null = data.challenges?.[0] ?? null;

      // Persist to localStorage for offline fallback
      if (challenge) {
        localStorage.setItem('currentChallenge', JSON.stringify(challenge));
      }

      return challenge;
    },
    enabled: !!userId,
    placeholderData: () => readLocalStorageChallenge() ?? undefined,
  });
}

/**
 * Fetches aggregate progress stats for the current user.
 */
export function useUserProgress(userId: string | undefined) {
  return useQuery<UserProgress | null>({
    queryKey: ['progress', userId],
    queryFn: async () => {
      const res = await fetch(`/api/progress?userId=${userId}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Failed to fetch progress (${res.status})`);
      const data = await res.json();
      return data.progress ?? null;
    },
    enabled: !!userId,
  });
}

/**
 * Fetches the 5 most recent challenges (any status) for the current user.
 */
export function useRecentChallenges(userId: string | undefined) {
  return useQuery<Challenge[]>({
    queryKey: ['challenges', 'recent', userId],
    queryFn: async () => {
      const res = await fetch(
        `/api/challenges?userId=${userId}&status=all&limit=5`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`Failed to fetch recent challenges (${res.status})`);
      const data = await res.json();
      return data.challenges ?? [];
    },
    enabled: !!userId,
  });
}

/**
 * Fetches saved itineraries for the current user.
 */
export function useItineraries(userId: string | undefined) {
  return useQuery<any[]>({
    queryKey: ['itineraries', userId],
    queryFn: async () => {
      const res = await fetch(`/api/itinerary?userId=${userId}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Failed to fetch itineraries (${res.status})`);
      const data = await res.json();
      return data.itineraries ?? [];
    },
    enabled: !!userId,
  });
}

/**
 * Returns a stable callback that invalidates all dashboard-related queries,
 * causing React Query to refetch them in the background.
 */
export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['challenges'] });
    queryClient.invalidateQueries({ queryKey: ['progress'] });
    queryClient.invalidateQueries({ queryKey: ['itineraries'] });
  }, [queryClient]);
}
