// The app's API client and query cache, tied to the Supabase session. The phone's network state
// drives TanStack's online state (refetch on reconnect), and coming back to the app refetches
// stale reads (focus).

import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { getSupabase } from '../auth/supabase';
import { ApiClientError, createApi, type Api } from '../lib/api';
import { appEnv } from '../lib/env';
import { claimSavedReads, savedReads } from './persist';
import { QUERY_DEFAULTS } from './query-defaults';

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)));
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
  return () => sub.remove();
});

export const queryClient = new QueryClient({ defaultOptions: QUERY_DEFAULTS });

/** Forgets everything read for the signed-in account: the cache and the copy kept on the phone. */
export function clearAccountData(): void {
  queryClient.clear();
  void savedReads.clear();
}

/** At sign-in: saved reads that belong to another account are dropped before anything shows. */
export function claimAccount(userId: string): void {
  claimSavedReads(userId, Storage, clearAccountData);
}

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
      clearAccountData();
    },
  });
  return api;
}
