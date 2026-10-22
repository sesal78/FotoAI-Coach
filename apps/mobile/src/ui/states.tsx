// The four states every screen shows (no silent failure): loading, empty, error with Retry,
// and offline. Error text comes from the server's message or the client's plain one.

import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ApiClientError } from '../lib/api';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <ActivityIndicator />
      <Text className="text-text-muted">{label}</Text>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="items-center gap-2 p-6">
      <Text className="text-lg font-semibold text-text">{title}</Text>
      {hint ? <Text className="text-center text-text-muted">{hint}</Text> : null}
    </View>
  );
}

export const isOffline = (error: unknown) => error instanceof ApiClientError && error.code === 'offline';

export function errorText(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Something went wrong. Please try again.';
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isOffline(error)) return <OfflineBanner onRetry={onRetry} />;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="m-4 gap-3 rounded-md bg-surface p-4">
      <Text className="text-danger">{errorText(error)}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} className="self-start rounded-pill bg-primary px-4 py-2">
          <Text className="font-semibold text-on-primary">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="offline-banner" className="m-4 flex-row items-center justify-between gap-3 rounded-md bg-surface-alt p-3">
      <Text className="flex-1 text-text">You are offline. Saved items still work.</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text className="font-semibold text-primary">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
