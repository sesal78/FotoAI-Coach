'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Challenge, UserProgress, PhotoCritique, ReverseAnalysis, WeeklyReport, EditingRecipeAnalysis, SkillTreeResponse, PortfolioAnalysisDoc } from '@/lib/types';
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
 * Fetches photo critiques for the current user.
 */
export function usePhotoCritiques(userId: string | undefined) {
  return useQuery<PhotoCritique[]>({
    queryKey: ['critiques', userId],
    queryFn: async () => {
      const res = await fetch(`/api/critiques?userId=${userId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch critiques (${res.status})`);
      const data = await res.json();
      return data.critiques ?? [];
    },
    enabled: !!userId,
  });
}

/**
 * Fetches reverse-engineering analyses for the current user.
 */
export function useReverseAnalyses(userId: string | undefined) {
  return useQuery<ReverseAnalysis[]>({
    queryKey: ['reverse-analyses', userId],
    queryFn: async () => {
      const res = await fetch(`/api/reverse-engineer?userId=${userId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch analyses (${res.status})`);
      const data = await res.json();
      return data.analyses ?? [];
    },
    enabled: !!userId,
  });
}

/**
 * Fetches editing recipe analyses for the current user.
 */
export function useEditingRecipes(userId: string | undefined) {
  return useQuery<EditingRecipeAnalysis[]>({
    queryKey: ['editing-recipes', userId],
    queryFn: async () => {
      const res = await fetch(`/api/editing-recipe?userId=${userId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch recipes (${res.status})`);
      const data = await res.json();
      return data.recipes ?? [];
    },
    enabled: !!userId,
  });
}

/**
 * Fetches weekly insight reports for the current user.
 */
export function useWeeklyInsights(userId: string | undefined, limit: number = 10) {
  return useQuery<WeeklyReport[]>({
    queryKey: ['weekly-insights', userId, limit],
    queryFn: async () => {
      const res = await fetch(`/api/insights?userId=${userId}&limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch insights (${res.status})`);
      const data = await res.json();
      return data.reports ?? [];
    },
    enabled: !!userId,
  });
}

/**
 * Fetches portfolio analysis history for the current user.
 */
export function usePortfolioAnalyses(userId: string | undefined, limit: number = 10) {
  return useQuery<any[]>({
    queryKey: ['portfolio-analyses', userId, limit],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio?userId=${userId}&limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch portfolio analyses (${res.status})`);
      const data = await res.json();
      return data.analyses ?? [];
    },
    enabled: !!userId,
  });
}

/**
 * Fetches the full skill tree state for the current user.
 */
export function useSkillTree(userId: string | undefined) {
  return useQuery<SkillTreeResponse>({
    queryKey: ['skill-tree', userId],
    queryFn: async () => {
      const res = await fetch(`/api/skills?userId=${userId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch skill tree (${res.status})`);
      return res.json();
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
    queryClient.invalidateQueries({ queryKey: ['fotoai', 'challenges'] });
    queryClient.invalidateQueries({ queryKey: ['fotoai', 'progress'] });
    queryClient.invalidateQueries({ queryKey: ['itineraries'] });
  }, [queryClient]);
}
