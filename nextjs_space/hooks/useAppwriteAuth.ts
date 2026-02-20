'use client';

import { useAuth } from '@/contexts/auth-context';

export type { AppwriteUser, AuthStatus } from '@/contexts/auth-context';

/**
 * Thin proxy that delegates to the shared AuthContext.
 *
 * All stateful logic now lives in AuthProvider (contexts/auth-context.tsx).
 * Keeping this hook preserves backward-compatible imports for every consumer
 * (Navbar, Dashboard, Login, Signup, Chat) with zero code changes.
 */
export function useAppwriteAuth() {
  return useAuth();
}
