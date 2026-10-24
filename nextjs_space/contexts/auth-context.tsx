'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getFotoaiSession,
  loginFotoai,
  logoutFotoai,
  registerFotoai,
  type FotoaiUser,
} from '@/lib/fotoai/client';
import { clearFotoaiQueryCache } from '@/lib/fotoai/query-cache';

// ── Types ──────────────────────────────────────────────────────────────────

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

// ── Context shape ──────────────────────────────────────────────────────────

interface AuthContextValue {
  user: FotoaiUser | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ confirmationRequired: boolean }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<FotoaiUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // The FotoAI API reads and verifies the HttpOnly session cookie server-side.
  const fetchUser = useCallback(async () => {
    try {
      setUser(await getFotoaiSession());
      setStatus('authenticated');
    } catch {
      clearFotoaiQueryCache(queryClient);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [queryClient]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await loginFotoai(email, password);
      clearFotoaiQueryCache(queryClient);
      const userData = await getFotoaiSession();
      setUser(userData);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await logoutFotoai();
    } finally {
      clearFotoaiQueryCache(queryClient);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [queryClient]);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await registerFotoai(email, password, name);
      clearFotoaiQueryCache(queryClient);
      if (result.confirmationRequired) {
        setUser(null);
        setStatus('unauthenticated');
        return result;
      }
      await fetchUser();
      return result;
    },
    [fetchUser, queryClient],
  );

  return (
    <AuthContext.Provider value={{ user, status, signIn, signOut, register }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Consumer hook ──────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
