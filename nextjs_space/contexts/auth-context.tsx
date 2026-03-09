'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AppwriteUser {
  id: string;
  email: string;
  name: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

// ── Context shape ──────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AppwriteUser | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Use our own /api/auth/me endpoint -- it reads the httpOnly session cookie
  // server-side. Calling account.get() from the browser SDK doesn't work because
  // the cookie lives on our domain, not on Appwrite's domain.
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Not authenticated');
      const data = await res.json();
      setUser({ id: data.id, email: data.email, name: data.name });
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      // Validate the new session — fetchUser sets status silently,
      // so we must verify it actually succeeded.
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        throw new Error('Session could not be verified. Please try again.');
      }
      const userData = await meRes.json();
      setUser({ id: userData.id, email: userData.email, name: userData.name });
      setStatus('authenticated');
    },
    [],
  );

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }
      await fetchUser();
    },
    [fetchUser],
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
