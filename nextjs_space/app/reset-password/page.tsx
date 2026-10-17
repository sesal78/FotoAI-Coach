'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { FotoaiClientError } from '@/lib/fotoai/client';
import { parseFotoaiLinkToken, resetFotoaiPassword } from '@/lib/fotoai/client-auth-flows';

type ResetToken = { accessToken: string } | { tokenHash: string };

function ResetPasswordForm() {
  // The reset link lands here with the recovery session in the URL fragment
  // (#access_token=...&type=recovery) or, with a custom template, ?token_hash=.
  const [linkToken, setLinkToken] = useState<ResetToken | null>(null);
  const [linkChecked, setLinkChecked] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const parsed = parseFotoaiLinkToken(window.location.hash, window.location.search);
    const isRecovery = (type: string | null) => type === null || type === 'recovery';
    if (parsed.kind === 'session' && isRecovery(parsed.type)) setLinkToken({ accessToken: parsed.accessToken });
    if (parsed.kind === 'hash' && isRecovery(parsed.type)) setLinkToken({ tokenHash: parsed.tokenHash });
    // Keep link tokens out of history, bookmarks and Referer headers.
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setLinkChecked(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!linkToken) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    setLoading(true);
    try {
      await resetFotoaiPassword(linkToken, password);
      setLinkToken(null);
      setSuccess(true);
    } catch (err) {
      if (err instanceof FotoaiClientError && err.status === 401) {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else if (err instanceof FotoaiClientError && err.status === 400) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!linkChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
        <div className="h-10 w-10 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!linkToken && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-3xl font-bold display-font">Invalid Reset Link</h1>
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block px-6 py-3 bg-foreground text-background text-sm font-semibold hover:bg-primary transition-colors"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <h1 className="text-4xl font-bold display-font tracking-tight mb-2">
            Set new password
          </h1>
          <p className="text-muted-foreground">
            Choose a strong password for your account.
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Password reset</h2>
              <p className="text-muted-foreground text-sm">
                Your password has been changed successfully.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-block px-6 py-3.5 bg-foreground text-background text-sm font-semibold hover:bg-primary transition-colors"
            >
              Sign in with new password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium tracking-wide">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 pr-12 bg-transparent border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium tracking-wide">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className="w-full px-4 py-3 bg-transparent border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background text-sm font-semibold tracking-wide transition-all duration-300 hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Resetting...
                </span>
              ) : (
                'Reset password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
