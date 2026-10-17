'use client';

import { useQuery } from '@tanstack/react-query';
import { type FotoaiWeeklyReport, listFotoaiWeeklyReports } from '@/lib/fotoai/client-features';

/**
 * Fetches weekly insight reports for the session user (newest first).
 */
export function useWeeklyInsights(enabled: boolean, limit: number = 10) {
  return useQuery<FotoaiWeeklyReport[]>({
    queryKey: ['fotoai', 'insights', limit],
    queryFn: () => listFotoaiWeeklyReports({ limit }),
    enabled,
  });
}
