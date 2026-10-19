// The one Supabase client (Auth and, later, Storage uploads), made only when the env is valid.
// The session is kept encrypted on the phone; the refresh timer runs only while the app is open.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { appEnv } from '../lib/env';
import { expoCryptoPort } from './expo-crypto-port';
import { createEncryptedStorage } from './storage';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client || !appEnv.ok) return client;
  const storage = createEncryptedStorage({
    secure: { get: (k) => SecureStore.getItemAsync(k), set: (k, v) => SecureStore.setItemAsync(k, v), remove: (k) => SecureStore.deleteItemAsync(k) },
    kv: { getItem: (k) => Storage.getItem(k), setItem: (k, v) => Storage.setItem(k, v), removeItem: (k) => Storage.removeItem(k) },
    crypto: expoCryptoPort,
  });
  client = createClient(appEnv.env.EXPO_PUBLIC_SUPABASE_URL, appEnv.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  const auth = client.auth;
  AppState.addEventListener('change', (state) => (state === 'active' ? auth.startAutoRefresh() : auth.stopAutoRefresh()));
  return client;
}
