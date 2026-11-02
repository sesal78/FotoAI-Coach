// The signed-in state for the whole app. Supabase keeps the session; this mirrors it as a status
// and offers sign-out. Every way into signed_out (Sign out, an expired or revoked session, no
// session at start) calls onSignedOut, so an account's data never outlives its session.
// One exception: offline at start with an expired access token, Supabase answers "no session" with
// a network error while the session is still stored. That is not a sign-out: the phone stays
// signed in as the last account, so its saved data and waiting changes show, until a refresh
// online works (TOKEN_REFRESHED) or is refused (SIGNED_OUT).

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

/** Auth could not be reached (no signal): the stored session may still be good. */
const isAuthOffline = (error: unknown) => {
  const e = error as { name?: string; status?: number } | null;
  return !!e && (e.name === 'AuthRetryableFetchError' || e.status === 0);
};

export function SessionProvider({
  auth,
  onSignedOut,
  onSignedIn,
  rememberedUser,
  children,
}: {
  auth: SessionAuth;
  onSignedOut?: () => void;
  onSignedIn?: (userId: string) => void;
  /** The account last signed in on this phone, kept for an offline start. */
  rememberedUser?: () => string | null;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const callbacks = useRef({ onSignedOut, onSignedIn, rememberedUser });
  useEffect(() => {
    callbacks.current = { onSignedOut, onSignedIn, rememberedUser };
  }, [onSignedOut, onSignedIn, rememberedUser]);

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
      .then(({ data, error }) => {
        const userId = !data.session && isAuthOffline(error) ? callbacks.current.rememberedUser?.() : null;
        apply(userId ? { user: { id: userId } } : (data.session as SessionLike));
      })
      .catch(() => apply(null));
    // INITIAL_SESSION repeats what getSession() answers above (and says "no session" offline), so
    // only later events count.
    const { data } = auth.onAuthStateChange((event, session) => event !== 'INITIAL_SESSION' && apply(session as SessionLike));
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
