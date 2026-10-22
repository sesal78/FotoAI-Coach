// The signed-in state for the whole app. Supabase keeps the session; this mirrors it as a status
// and offers sign-out. Every way into signed_out (Sign out, an expired or revoked session, no
// session at start) calls onSignedOut, so an account's data never outlives its session.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type SessionStatus = 'loading' | 'signed_out' | 'signed_in';
export type SessionAuth = Pick<SupabaseClient['auth'], 'getSession' | 'onAuthStateChange' | 'signOut'>;

interface SessionValue {
  status: SessionStatus;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

type SessionLike = { user?: { id?: string } } | null;

export function SessionProvider({
  auth,
  onSignedOut,
  onSignedIn,
  children,
}: {
  auth: SessionAuth;
  onSignedOut?: () => void;
  onSignedIn?: (userId: string) => void;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const callbacks = useRef({ onSignedOut, onSignedIn });
  useEffect(() => {
    callbacks.current = { onSignedOut, onSignedIn };
  }, [onSignedOut, onSignedIn]);

  useEffect(() => {
    let alive = true;
    const apply = (session: SessionLike) => {
      if (!alive) return;
      if (session) {
        if (session.user?.id) callbacks.current.onSignedIn?.(session.user.id);
        setStatus('signed_in');
      } else {
        callbacks.current.onSignedOut?.();
        setStatus('signed_out');
      }
    };
    auth
      .getSession()
      .then(({ data }) => apply(data.session as SessionLike))
      .catch(() => apply(null));
    const { data } = auth.onAuthStateChange((_event, session) => apply(session as SessionLike));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [auth]);

  const signOut = useCallback(async () => {
    try {
      await auth.signOut({ scope: 'local' });
    } catch {
      // The phone is signed out below either way.
    } finally {
      onSignedOut?.();
      setStatus('signed_out');
    }
  }, [auth, onSignedOut]);

  const value = useMemo(() => ({ status, signOut }), [status, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be inside SessionProvider');
  return value;
}
