'use client';

import { useQuery } from '@tanstack/react-query';
import { listFotoaiPortfolioAnalyses, type FotoaiPortfolioAnalysis } from '@/lib/fotoai/client-ai';

/** Portfolio-analysis history of the session user (identity from the session cookie). */
export function usePortfolioAnalyses(enabled: boolean, limit: number = 10) {
  return useQuery<FotoaiPortfolioAnalysis[]>({
    queryKey: ['fotoai', 'portfolio', limit],
    queryFn: () => listFotoaiPortfolioAnalyses(limit),
    enabled,
  });
}
