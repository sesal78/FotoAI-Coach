// Shared fakes for the route tests: Supabase auth, env and the API (no network).
export const mockState = {
  session: null as object | null,
  listener: null as ((event: string, s: object | null) => void) | null,
  signIn: jest.fn(),
  request: jest.fn(),
};

export const fakeSupabase = () => ({
  auth: {
    getSession: async () => ({ data: { session: mockState.session }, error: null }),
    onAuthStateChange: (cb: (event: string, s: object | null) => void) => {
      mockState.listener = cb;
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
    signOut: async () => ({ error: null }),
    signInWithPassword: (...args: unknown[]) => mockState.signIn(...args),
  },
});

export const fakeEnv = {
  appEnv: { ok: true, env: { EXPO_PUBLIC_API_URL: 'https://api.example', EXPO_PUBLIC_SUPABASE_URL: 'https://sb.example', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon' } },
};
