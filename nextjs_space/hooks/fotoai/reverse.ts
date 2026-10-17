'use client';

import { useQuery } from '@tanstack/react-query';
import { listFotoaiReverseAnalyses, type FotoaiReverseAnalysis } from '@/lib/fotoai/client-ai';

/** Reverse-engineering history of the session user (identity from the session cookie). */
export function useReverseAnalyses(enabled: boolean) {
  return useQuery<FotoaiReverseAnalysis[]>({
    queryKey: ['fotoai', 'reverse'],
    queryFn: () => listFotoaiReverseAnalyses(),
    enabled,
  });
}
