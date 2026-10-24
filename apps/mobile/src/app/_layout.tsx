import '../global.css';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { SessionProvider, useSession } from '../auth/session';
import { getSupabase } from '../auth/supabase';
import { claimAccount, clearAccountData, queryClient, startFieldSync } from '../data/client';
import { savedReads } from '../data/persist';
import { appEnv } from '../lib/env';
import { Screen } from '../ui/form';
import { Loading } from '../ui/states';
import { ThemeProvider } from '../ui/ThemeProvider';

export default function RootLayout() {
  const supabase = getSupabase();
  useEffect(() => startFieldSync(), []);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={savedReads.options}>
      <ThemeProvider>
        {appEnv.ok && supabase ? (
          <SessionProvider auth={supabase.auth} onSignedOut={clearAccountData} onSignedIn={claimAccount}>
            <Navigator />
          </SessionProvider>
        ) : (
          <NotConfigured problems={appEnv.ok ? [] : appEnv.problems} />
        )}
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

function Navigator() {
  const { status } = useSession();
  if (status === 'loading') return <Loading />;
  const signedIn = status === 'signed_in';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenge/[id]" />
        <Stack.Screen name="me/skills" />
        <Stack.Screen name="me/gear/index" />
        <Stack.Screen name="me/gear/add" />
        <Stack.Screen name="me/gear/custom" />
        <Stack.Screen name="me/loadout" />
        <Stack.Screen name="me/settings" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="place/[placeId]" />
        <Stack.Screen name="plan/[id]" />
        <Stack.Screen name="roll/load" />
        <Stack.Screen name="roll/[id]" />
        <Stack.Screen name="spot/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* The reset link works signed in or out. */}
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

function NotConfigured({ problems }: { problems: string[] }) {
  return (
    <Screen title="App not configured">
      <Text className="text-text">This build is missing settings: {problems.join(', ') || 'unknown'}.</Text>
    </Screen>
  );
}
