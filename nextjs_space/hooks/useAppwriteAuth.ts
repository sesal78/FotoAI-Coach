'use client';

import { useState, useEffect, useCallback } from 'react';
import { account } from '@/lib/appwrite';

export interface AppwriteUser {
  id: string;
  email: string;
  name: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function useAppwriteAuth() {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const fetchUser = useCallback(async () => {
    try {
      const appwriteUser = await account.get();
      setUser({ id: appwriteUser.$id, email: appwriteUser.email, name: appwriteUser.name });
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed');
    }
    await fetchUser();
  }, [fetchUser]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
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
  }, [fetchUser]);

  return { user, status, signIn, signOut, register };
}
