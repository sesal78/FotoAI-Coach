'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle } from 'lucide-react';
import { FotoaiClientError } from '@/lib/fotoai/client';
import { parseFotoaiLinkToken, verifyFotoaiEmail } from '@/lib/fotoai/client-auth-flows';

const EXPIRED_MESSAGE = 'Invalid or expired verification link. Please request a new one.';

function ConfirmContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // GoTrue redirects here with the new session in the URL fragment
    // (#access_token=...&refresh_token=...&type=signup); a custom template may
    // send ?token_hash=...&type=email instead. Read it once, then drop it from
    // the address bar so it never lands in history or a Referer header.
    // Only the access token is sent, to confirm the link: this page never
    // signs anyone in (a link could carry someone else's session).
    if (started.current) return;
    started.current = true;
    const parsed = parseFotoaiLinkToken(window.location.hash, window.location.search);
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    let token: Parameters<typeof verifyFotoaiEmail>[0] | null = null;
    if (parsed.kind === 'session' && (parsed.type === null || parsed.type === 'signup' || parsed.type === 'email')) {
      token = { accessToken: parsed.accessToken };
    } else if (parsed.kind === 'hash' && (parsed.type === null || parsed.type === 'signup' || parsed.type === 'email')) {
      token = { tokenHash: parsed.tokenHash, type: parsed.type ?? undefined };
    }

    if (!token) {
      setStatus('error');
      setErrorMsg(EXPIRED_MESSAGE);
      return;
    }

    verifyFotoaiEmail(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => window.location.replace('/login?verified=1'), 2500);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err instanceof FotoaiClientError && (err.status === 400 || err.status === 401)
          ? EXPIRED_MESSAGE
          : 'Verification failed. Please try again.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">

        {status === 'loading' && (
          <>
            <div className="mb-8 flex justify-center">
              <div className="h-16 w-16 border-2 border-border border-t-foreground rounded-full animate-spin" />
            </div>
            <h1 className="text-3xl font-bold display-font tracking-tight mb-2">
              Verifying your email…
            </h1>
            <p className="text-muted-foreground">This will only take a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-8 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <h1 className="text-3xl font-bold display-font tracking-tight mb-2">
              Email verified!
            </h1>
            <p className="text-muted-foreground">
              Your account is confirmed. Redirecting you to sign in…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-8 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
            </div>
            <h1 className="text-3xl font-bold display-font tracking-tight mb-2">
              Verification failed
            </h1>
            <p className="text-muted-foreground mb-8">{errorMsg}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/verify-email"
                className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-background text-sm font-semibold tracking-wide transition-all duration-300 hover:bg-primary"
              >
                Request new link
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground text-sm font-medium tracking-wide transition-all duration-300 hover:bg-muted"
              >
                Sign in
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  );
}
