'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const secret = searchParams.get('secret') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!userId || !secret) {
      setStatus('error');
      setErrorMsg('Invalid or expired verification link. Please request a new one.');
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, secret }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStatus('success');
        setTimeout(() => router.replace('/dashboard'), 2500);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'Verification failed. The link may have expired.');
      }
    }

    verify();
  }, [userId, secret, router]);

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
              Your account is confirmed. Redirecting you to the dashboard…
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
