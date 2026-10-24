'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Camera, Check } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

const PERKS = [
  'Personalised daily photo challenges',
  'AI-generated location itineraries',
  'Streak tracking & progress stats',
  'Weather-aware coaching',
];

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/dashboard';
  const { register, status } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Prevent the "already authenticated" redirect from firing after registration
  const justRegistered = useRef(false);

  useEffect(() => {
    if (status === 'authenticated' && !justRegistered.current) {
      router.replace(from);
    }
  }, [status, router, from]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Full name is required';
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      justRegistered.current = true;
      const result = await register(email, password, name);
      if (result.confirmationRequired) {
        setError('Account created. Confirm your email, then sign in.');
        return;
      }
      router.replace('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground relative overflow-hidden">
        <div className="absolute inset-0 grain-overlay opacity-40" aria-hidden="true" />
        <div className="relative z-10 flex flex-col justify-between p-16 text-background w-full">
          <Link href="/" className="text-3xl font-bold tracking-tight display-font text-background">
            Foto
          </Link>
          <div>
            <p className="text-5xl font-bold display-font leading-tight mb-8">
              Start your<br />
              <span className="text-primary italic">photography</span><br />
              journey today.
            </p>
            <ul className="space-y-3">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-3 text-background/80 text-sm">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-3 text-background/40 text-sm">
            <Camera className="h-4 w-4" />
            <span>Free to get started</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16 lg:px-16">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Link href="/" className="text-2xl font-bold tracking-tight display-font">
              Foto
            </Link>
          </div>

          <div className="mb-10">
            <h1 className="text-4xl font-bold display-font tracking-tight mb-2">
              Create account
            </h1>
            <p className="text-muted-foreground">
              Join and start shooting with purpose
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium tracking-wide">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => { setName(e.target.value); setFieldErrors((prev) => { const { name: _, ...rest } = prev; return rest; }); }}
                placeholder="Alex Johnson"
                className={`w-full px-4 py-3 bg-transparent border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors text-sm ${fieldErrors.name ? 'border-destructive' : 'border-border'}`}
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium tracking-wide">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => { const { email: _, ...rest } = prev; return rest; }); }}
                placeholder="you@example.com"
                className={`w-full px-4 py-3 bg-transparent border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors text-sm ${fieldErrors.email ? 'border-destructive' : 'border-border'}`}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => { const { password: _, ...rest } = prev; return rest; }); }}
                  placeholder="Min. 8 characters"
                  className={`w-full px-4 py-3 pr-12 bg-transparent border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors text-sm ${fieldErrors.password ? 'border-destructive' : 'border-border'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`flex-1 h-0.5 transition-colors duration-300 ${
                        password.length >= level * 3
                          ? password.length < 6
                            ? 'bg-destructive'
                            : password.length < 10
                            ? 'bg-primary'
                            : 'bg-green-500'
                          : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
              )}
              {fieldErrors.password && <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background text-sm font-semibold tracking-wide transition-all duration-300 hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              By signing up you agree to our{' '}
              <span className="underline underline-offset-2 cursor-default">Terms of Service</span>
              {' '}and{' '}
              <span className="underline underline-offset-2 cursor-default">Privacy Policy</span>.
            </p>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs tracking-widest uppercase">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href={`/login${from !== '/dashboard' ? `?from=${encodeURIComponent(from)}` : ''}`}
              className="text-foreground font-medium underline underline-offset-2 hover:text-primary transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
