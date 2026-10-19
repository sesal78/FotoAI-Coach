import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Text } from 'react-native';

import { SessionProvider, useSession } from '../auth/session';
import { getSupabase } from '../auth/supabase';
import { queryClient } from '../data/client';
import { appEnv } from '../lib/env';
import { Screen } from '../ui/form';
import { Loading } from '../ui/states';
import { ThemeProvider } from '../ui/ThemeProvider';

export default function RootLayout() {
  const supabase = getSupabase();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {appEnv.ok && supabase ? (
          <SessionProvider auth={supabase.auth} onSignedOut={() => queryClient.clear()}>
            <Navigator />
          </SessionProvider>
        ) : (
          <NotConfigured problems={appEnv.ok ? [] : appEnv.problems} />
        )}
      </ThemeProvider>
    </QueryClientProvider>
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
