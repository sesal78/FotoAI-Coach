// How many field changes wait to be sent, and how many need attention. Hidden when none; a tap
// opens the list.

import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useOutbox } from '../../data/shoot';

export const waitingText = (n: number) => `${n} change${n === 1 ? '' : 's'} waiting to send`;

export function WaitingBadge() {
  const items = useOutbox();
  const waiting = items.filter((i) => i.state === 'waiting').length;
  const attention = items.length - waiting;
  if (items.length === 0) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/me/sync')} className="min-h-11 justify-center gap-1 rounded-md border border-border bg-surface-alt px-3 py-2">
      {waiting > 0 ? <Text className="font-semibold text-text">{waitingText(waiting)}</Text> : null}
      {attention > 0 ? <Text className="font-semibold text-danger">{`${attention} need${attention === 1 ? 's' : ''} attention`}</Text> : null}
    </Pressable>
  );
}
