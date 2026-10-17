'use client';

import { useQuery } from '@tanstack/react-query';
import type { SkillTreeResponse } from '@/lib/types';
import { getFotoaiSkillTree } from '@/lib/fotoai/client-features';

/**
 * Fetches the full skill tree state for the session user.
 */
export function useSkillTree(enabled: boolean) {
  return useQuery<SkillTreeResponse>({
    queryKey: ['fotoai', 'skills'],
    queryFn: () => getFotoaiSkillTree(),
    enabled,
  });
}
