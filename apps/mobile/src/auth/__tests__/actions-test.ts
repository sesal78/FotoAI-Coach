import { completeReset, requestReset, RESET_REDIRECT, signIn, signUp, VERIFY_REDIRECT, type AuthPort } from '../actions';

function client(over: Record<string, jest.Mock> = {}) {
  const base = {
    signInWithPassword: jest.fn(async () => ({ data: { session: { access_token: 't' } }, error: null })),
    signUp: jest.fn(async () => ({ data: { user: { id: 'u', identities: [{}] }, session: null }, error: null })),
    resend: jest.fn(async () => ({ data: {}, error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
    setSession: jest.fn(async () => ({ data: { session: {} }, error: null })),
    updateUser: jest.fn(async () => ({ data: { user: {} }, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
  };
  const merged = { ...base, ...over };
  return merged as unknown as AuthPort & typeof base;
}
const authError = (code: string, message = 'x', status = 400) => ({ name: 'AuthApiError', code, message, status });

describe('sign in', () => {
  test('a wrong password shows "Wrong email or password" and stores nothing', async () => {
    const c = client({ signInWithPassword: jest.fn(async () => ({ data: { session: null }, error: authError('invalid_credentials') })) });
    expect(await signIn(c, ' Seun@Example.com ', 'nope-nope')).toEqual({ ok: false, message: 'Wrong email or password.' });
    expect(c.signInWithPassword).toHaveBeenCalledWith({ email: 'seun@example.com', password: 'nope-nope' });
  });

  test('an unconfirmed email and an offline phone get their own plain messages', async () => {
    const unconfirmed = client({ signInWithPassword: jest.fn(async () => ({ data: { session: null }, error: authError('email_not_confirmed') })) });
    expect(await signIn(unconfirmed, 'a@b.co', 'password1')).toMatchObject({ ok: false, message: expect.stringMatching(/confirm your email/i) });
    const offline = client({
      signInWithPassword: jest.fn(async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 } })),
    });
    expect(await signIn(offline, 'a@b.co', 'password1')).toMatchObject({ ok: false, message: expect.stringMatching(/no connection/i) });
  });
});

describe('sign up', () => {
  test('sign-up sends the web confirm page as the redirect and shows Check email', async () => {
    const c = client();
    expect(await signUp(c, 'new@example.com', 'longenough', 'longenough')).toEqual({ ok: true, next: 'check_email' });
    expect(c.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'longenough', options: { emailRedirectTo: VERIFY_REDIRECT } });
    expect(VERIFY_REDIRECT).toBe('https://myfoto.topues.com/verify-email/confirm');
  });

  test('an email already in use gets the same Check email screen', async () => {
    const existing = client({ signUp: jest.fn(async () => ({ data: { user: { id: 'u', identities: [] }, session: null }, error: null })) });
    expect(await signUp(existing, 'old@example.com', 'longenough', 'longenough')).toEqual({ ok: true, next: 'check_email' });
    const refused = client({ signUp: jest.fn(async () => ({ data: { user: null, session: null }, error: authError('user_already_exists') })) });
    expect(await signUp(refused, 'old@example.com', 'longenough', 'longenough')).toEqual({ ok: true, next: 'check_email' });
  });

  test('mismatched or short passwords, or a bad email, are refused before any call', async () => {
    const c = client();
    expect((await signUp(c, 'a@b.co', 'longenough', 'different1')).message).toMatch(/do not match/i);
    expect((await signUp(c, 'a@b.co', 'short', 'short')).message).toMatch(/at least 8/i);
    expect((await signUp(c, 'not-an-email', 'longenough', 'longenough')).message).toMatch(/email/i);
    expect(c.signUp).not.toHaveBeenCalled();
  });
});

describe('password reset', () => {
  test('forgot password always gives the same answer', async () => {
    const good = client();
    const bad = client({ resetPasswordForEmail: jest.fn(async () => ({ data: null, error: authError('user_not_found') })) });
    const a = await requestReset(good, 'a@b.co');
    const b = await requestReset(bad, 'nobody@b.co');
    expect(a).toEqual(b);
    expect(good.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', { redirectTo: RESET_REDIRECT });
    expect(RESET_REDIRECT).toBe('https://myfoto.topues.com/reset-password');
  });

  const LINK = 'https://myfoto.topues.com/reset-password#access_token=at-1&refresh_token=rt-1&expires_in=3600&type=recovery';

  test('a recovery link sets the new password, then signs out', async () => {
    const c = client();
    expect(await completeReset(c, LINK, 'brand-new-pw', 'brand-new-pw')).toEqual({ ok: true, next: 'signed_out' });
    expect(c.setSession).toHaveBeenCalledWith({ access_token: 'at-1', refresh_token: 'rt-1' });
    expect(c.updateUser).toHaveBeenCalledWith({ password: 'brand-new-pw' });
    expect(c.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('an expired recovery link offers a new link and changes nothing', async () => {
    const c = client();
    const expired = 'https://myfoto.topues.com/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(await completeReset(c, expired, 'brand-new-pw', 'brand-new-pw')).toEqual({ ok: false, next: 'expired', message: expect.stringMatching(/expired/i) });
    expect(await completeReset(c, 'https://myfoto.topues.com/reset-password', 'brand-new-pw', 'brand-new-pw')).toMatchObject({ next: 'expired' });
    expect(await completeReset(c, LINK.replace('type=recovery', 'type=signup'), 'brand-new-pw', 'brand-new-pw')).toMatchObject({ next: 'expired' });
    expect(c.setSession).not.toHaveBeenCalled();
    expect(c.updateUser).not.toHaveBeenCalled();
  });

  test('a failed password change still signs the recovery session out', async () => {
    const c = client({ updateUser: jest.fn(async () => ({ data: { user: null }, error: authError('weak_password', 'weak') })) });
    expect(await completeReset(c, LINK, 'brand-new-pw', 'brand-new-pw')).toMatchObject({ ok: false, next: 'retry' });
    expect(c.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('mismatched new passwords are refused before the link is used', async () => {
    const c = client();
    expect((await completeReset(c, LINK, 'brand-new-pw', 'other-pw-123')).message).toMatch(/do not match/i);
    expect(c.setSession).not.toHaveBeenCalled();
  });
});
