'use client';

import { useQuery } from '@tanstack/react-query';
import { type FotoaiCritique, listFotoaiCritiques } from '@/lib/fotoai/client-features';

/**
 * Fetches photo critiques for the session user (newest first).
 */
export function usePhotoCritiques(enabled: boolean) {
  return useQuery<FotoaiCritique[]>({
    queryKey: ['fotoai', 'critiques'],
    queryFn: () => listFotoaiCritiques(),
    enabled,
  });
}
