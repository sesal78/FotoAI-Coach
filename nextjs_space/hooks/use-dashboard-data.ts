'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Challenge, UserProgress } from '@/lib/types';
import { getFotoaiProgress, listFotoaiChallenges } from '@/lib/fotoai/client';

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetches the single pending challenge for the current user.
 */
export function usePendingChallenge(enabled: boolean) {
  return useQuery<Challenge | null>({
    queryKey: ['fotoai', 'challenges', 'pending'],
    queryFn: async () => {
      const challenge = (await listFotoaiChallenges({ status: 'pending', limit: 1 }))[0] ?? null;

      return challenge;
    },
    enabled,
  });
}

/**
 * Fetches aggregate progress stats for the current user.
 */
export function useUserProgress(enabled: boolean) {
  return useQuery<UserProgress | null>({
    queryKey: ['fotoai', 'progress'],
    queryFn: () => getFotoaiProgress(),
    enabled,
  });
}

/**
 * Fetches the most recent challenges (any status) for the current user.
 * Supports pagination via limit parameter.
 */
export function useRecentChallenges(limit: number = 5, enabled: boolean = true) {
  return useQuery<{ challenges: Challenge[]; hasMore: boolean }>({
    queryKey: ['fotoai', 'challenges', 'recent', limit],
    queryFn: async () => {
      const all = await listFotoaiChallenges({ status: 'all', limit: limit + 1 });
      const hasMore = all.length > limit;
      return { challenges: all.slice(0, limit), hasMore };
    },
    enabled,
  });
}

/**
 * Returns a stable callback that invalidates all dashboard-related queries,
 * causing React Query to refetch them in the background.
 */
export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fotoai', 'challenges'] });
    queryClient.invalidateQueries({ queryKey: ['fotoai', 'progress'] });
    queryClient.invalidateQueries({ queryKey: ['fotoai', 'itineraries'] });
  }, [queryClient]);
}
