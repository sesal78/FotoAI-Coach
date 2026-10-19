// Supabase Auth errors in plain words. Codes from GoTrue's error codes; anything unknown gets a
// general message (the raw server text is never shown, it can be technical).

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'Please confirm your email first. Check your inbox for the link.',
  over_request_rate_limit: 'Too many tries. Wait a minute and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a minute and try again.',
  weak_password: 'That password is too weak. Use a longer one.',
  same_password: 'Use a password you have not used before.',
  signup_disabled: 'New accounts are closed right now.',
  email_address_invalid: 'Enter a valid email address.',
};

export function authMessage(error: unknown): string {
  const e = error as { name?: string; code?: string; status?: number } | null;
  if (e?.name === 'AuthRetryableFetchError' || e?.status === 0) return 'No connection. Check your signal and try again.';
  if (e?.code && BY_CODE[e.code]) return BY_CODE[e.code]!;
  if (e?.status === 429) return BY_CODE.over_request_rate_limit!;
  return 'Something went wrong. Please try again.';
}
