// Account actions on Supabase Auth, in plain words. The email links go to pages on
// myfoto.topues.com that the shared Supabase already allows, so no Auth setting changes:
// the confirm link confirms on the web, and the reset link opens the app (Android App Link)
// or the web page when the app is not installed.

import { authMessage } from './messages';

export const VERIFY_REDIRECT = 'https://myfoto.topues.com/verify-email/confirm';
export const RESET_REDIRECT = 'https://myfoto.topues.com/reset-password';
export const MIN_PASSWORD = 8;

type AuthResult = { error: unknown };

/** The part of supabase.auth the app uses (a fake in tests). */
export interface AuthPort {
  signInWithPassword(c: { email: string; password: string }): Promise<AuthResult>;
  signUp(c: { email: string; password: string; options: { emailRedirectTo: string } }): Promise<AuthResult>;
  resend(c: { type: 'signup'; email: string; options: { emailRedirectTo: string } }): Promise<AuthResult>;
  resetPasswordForEmail(email: string, o: { redirectTo: string }): Promise<AuthResult>;
  setSession(s: { access_token: string; refresh_token: string }): Promise<AuthResult>;
  updateUser(u: { password: string }): Promise<AuthResult>;
  signOut(o: { scope: 'local' }): Promise<AuthResult>;
}

export type Outcome<N extends string = never> = { ok: true; next?: N } | { ok: false; message: string; next?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (email: string) => email.trim().toLowerCase();

function checkNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > 1024) return 'That password is too long.';
  if (password !== confirm) return 'The passwords do not match.';
  return null;
}

export async function signIn(auth: AuthPort, email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const e = clean(email);
  if (!EMAIL.test(e) || !password) return { ok: false, message: 'Enter your email and password.' };
  const { error } = await auth.signInWithPassword({ email: e, password });
  return error ? { ok: false, message: authMessage(error) } : { ok: true };
}

/**
 * Creates the account and asks the user to confirm the email. An email that already has an
 * account gets the same answer (Supabase hides it too), so the form cannot be used to probe accounts.
 */
export async function signUp(auth: AuthPort, email: string, password: string, confirm: string) {
  const e = clean(email);
  if (!EMAIL.test(e)) return { ok: false as const, message: 'Enter a valid email address.' };
  const problem = checkNewPassword(password, confirm);
  if (problem) return { ok: false as const, message: problem };
  const { error } = await auth.signUp({ email: e, password, options: { emailRedirectTo: VERIFY_REDIRECT } });
  if (error && (error as { code?: string }).code !== 'user_already_exists') return { ok: false as const, message: authMessage(error) };
  return { ok: true as const, next: 'check_email' as const };
}

export async function resendConfirmation(auth: AuthPort, email: string) {
  const { error } = await auth.resend({ type: 'signup', email: clean(email), options: { emailRedirectTo: VERIFY_REDIRECT } });
  return error ? { ok: false as const, message: authMessage(error) } : { ok: true as const };
}

const RESET_SENT = 'If that email has an account, a reset link is on its way.';

/** Always the same answer, whether or not the email has an account. */
export async function requestReset(auth: AuthPort, email: string) {
  const e = clean(email);
  if (EMAIL.test(e)) await auth.resetPasswordForEmail(e, { redirectTo: RESET_REDIRECT }).catch(() => undefined);
  return { ok: true as const, message: RESET_SENT };
}

/** Reads the recovery tokens from the link fragment; null when the link is expired, broken or not a recovery link. */
export function parseRecoveryLink(url: string): { access_token: string; refresh_token: string } | null {
  const hash = url.split('#')[1];
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  if (params.get('error') || params.get('type') !== 'recovery') return null;
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

const EXPIRED = 'This reset link has expired or was already used. Ask for a new one.';

/**
 * Sets the new password with the link's recovery session, then always signs that session out, so a
 * link carrying someone else's token never leaves this phone signed in to their account.
 */
export async function completeReset(auth: AuthPort, url: string, password: string, confirm: string) {
  const problem = checkNewPassword(password, confirm);
  if (problem) return { ok: false as const, next: 'retry' as const, message: problem };
  const tokens = parseRecoveryLink(url);
  if (!tokens) return { ok: false as const, next: 'expired' as const, message: EXPIRED };
  const opened = await auth.setSession(tokens);
  if (opened.error) return { ok: false as const, next: 'expired' as const, message: EXPIRED };
  try {
    const { error } = await auth.updateUser({ password });
    if (error) return { ok: false as const, next: 'retry' as const, message: authMessage(error) };
    return { ok: true as const, next: 'signed_out' as const };
  } finally {
    await auth.signOut({ scope: 'local' });
  }
}
