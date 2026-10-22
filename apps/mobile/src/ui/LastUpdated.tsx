// "Last updated 14:05" under a section that shows a saved read while the phone is offline.

import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { Text } from 'react-native';

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, () => onlineManager.isOnline());
}

const two = (n: number) => String(n).padStart(2, '0');

/** The phone's clock time of a moment, HH:MM. */
export function clockAt(ms: number): string {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

export function LastUpdated({ at }: { at: number }) {
  const online = useIsOnline();
  if (online || !at) return null;
  return <Text className="text-sm text-text-muted">Last updated {clockAt(at)}</Text>;
}
