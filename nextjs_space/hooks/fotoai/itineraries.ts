'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFotoaiItinerary,
  listFotoaiItineraries,
  type FotoaiItinerary,
} from '@/lib/fotoai/client-itineraries';

// Under the 'fotoai' root so clearFotoaiQueryCache drops it on session change.
export const FOTOAI_ITINERARIES_KEY = ['fotoai', 'itineraries'] as const;

/** The session user's saved itineraries (same data shape as the old useItineraries). */
export function useItineraries(enabled: boolean, limit: number = 10) {
  return useQuery<FotoaiItinerary[]>({
    queryKey: [...FOTOAI_ITINERARIES_KEY, limit],
    queryFn: () => listFotoaiItineraries({ limit }),
    enabled,
  });
}

/** Generates and saves an itinerary, then refreshes the list. */
export function useCreateItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { location: string; duration?: string }) => createFotoaiItinerary(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOTOAI_ITINERARIES_KEY }),
  });
}
