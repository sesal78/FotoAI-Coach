'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    setResending(true);
    setResent(false);
    setError('');
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend email');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-10 w-10 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-bold display-font tracking-tight mb-3">
          Check your inbox
        </h1>

        <p className="text-muted-foreground">
          We sent a verification link to
        </p>
        {email && (
          <p className="font-semibold text-foreground mt-1 mb-6">{email}</p>
        )}
        {!email && <div className="mb-6" />}

        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Click the link in the email to activate your account.
          Check your spam folder if you don't see it within a few minutes.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        {resent && (
          <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Verification email resent
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 border border-border text-foreground text-sm font-medium tracking-wide transition-all duration-300 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
          {cooldown > 0
            ? `Resend in ${cooldown}s`
            : resending
            ? 'Sending…'
            : 'Resend verification email'}
        </button>

        <p className="text-sm text-muted-foreground">
          Wrong email?{' '}
          <Link
            href="/signup"
            className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
          >
            Sign up again
          </Link>
          {' '}·{' '}
          <Link
            href="/login"
            className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
