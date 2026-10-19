// The app's API client and query cache, tied to the Supabase session.

import { QueryClient } from '@tanstack/react-query';

import { getSupabase } from '../auth/supabase';
import { ApiClientError, createApi, type Api } from '../lib/api';
import { appEnv } from '../lib/env';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry only what can get better (offline, upstream, rate limit); never a 4xx.
      retry: (count, error) => error instanceof ApiClientError && error.retryable && count < 2,
      staleTime: 30_000,
    },
  },
});

let api: Api | null = null;

export function getApi(): Api {
  if (api) return api;
  const supabase = getSupabase();
  if (!supabase || !appEnv.ok) throw new Error('FotoAI is not configured');
  api = createApi({
    baseUrl: appEnv.env.EXPO_PUBLIC_API_URL,
    getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    refresh: async () => {
      const { error } = await supabase.auth.refreshSession();
      if (!error) return 'refreshed';
      // Auth unreachable is not a sign-out: the session may still be good.
      if (error.name === 'AuthRetryableFetchError' || error.status === 0) throw new ApiClientError('offline', 0, 'No connection to FotoAI. Check your signal and try again.');
      return 'refused';
    },
    onSignedOut: () => {
      void supabase.auth.signOut({ scope: 'local' });
      queryClient.clear();
    },
  });
  return api;
}
