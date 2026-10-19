// The signed-in state for the whole app. Supabase keeps the session; this mirrors it as a status
// and offers sign-out, which also lets the caller clear cached data.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type SessionStatus = 'loading' | 'signed_out' | 'signed_in';
export type SessionAuth = Pick<SupabaseClient['auth'], 'getSession' | 'onAuthStateChange' | 'signOut'>;

interface SessionValue {
  status: SessionStatus;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ auth, onSignedOut, children }: { auth: SessionAuth; onSignedOut?: () => void; children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let alive = true;
    auth
      .getSession()
      .then(({ data }) => alive && setStatus(data.session ? 'signed_in' : 'signed_out'))
      .catch(() => alive && setStatus('signed_out'));
    const { data } = auth.onAuthStateChange((_event, session) => setStatus(session ? 'signed_in' : 'signed_out'));
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
