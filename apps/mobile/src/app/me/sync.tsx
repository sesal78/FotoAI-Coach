// Changes waiting to send: how many wait, "Send now" (sends at once, even while one waits to try
// again), a change that keeps failing (with its last message), and the ones the server refused
// ("Needs attention"), each with Try again or Remove (asks first). Nothing here is ever dropped
// without the user's yes.

import { router } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { fieldOwner, kickSync, outbox } from '../../data/field';
import type { OutboxItem } from '../../data/outbox';
import { useOutbox } from '../../data/shoot';
import { PrimaryButton, Screen, TextLink } from '../../ui/form';
import { waitingText } from '../../ui/shoot/WaitingBadge';

function describe(item: OutboxItem): string {
  if (item.kind === 'frame') return `Frame ${(item.body as { frameNo?: number }).frameNo ?? ''}`.trim();
  if (item.kind === 'step') return 'A step change';
  if (item.kind === 'plan') return 'A plan change';
  if (item.kind === 'roll') return 'A film roll';
  return 'A finished roll';
}

export default function SyncScreen() {
  const items = useOutbox();
  const waiting = items.filter((i) => i.state === 'waiting');
  const attention = items.filter((i) => i.state === 'attention');
  // After 3 failed tries a change shows why it waits, and may be removed.
  const stuck = waiting.filter((i) => i.attempts >= 3 && i.error);
  const sendNow = () => {
    const owner = fieldOwner();
    if (owner) void outbox.sendNow(owner).then(kickSync);
  };

  const confirmRemove = (item: OutboxItem) =>
    Alert.alert('Remove this change?', `${describe(item)} is not on FotoAI and will be lost.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void outbox.remove(item.id) },
    ]);

  return (
    <Screen title="Changes waiting">
      <TextLink title="Back" onPress={() => router.back()} />
      <Text className="text-lg font-semibold text-text">{waiting.length > 0 ? waitingText(waiting.length) : 'Nothing waiting: everything is sent.'}</Text>
      {waiting.length > 0 ? <PrimaryButton title="Send now" onPress={sendNow} /> : null}
      {stuck.map((item) => (
        <View key={item.id} className="gap-2 rounded-lg border border-border bg-surface p-4">
          <Text className="font-semibold text-text">{describe(item)}</Text>
          <Text className="text-text-muted">{`Still trying: ${item.error}`}</Text>
          <TextLink title="Remove" onPress={() => confirmRemove(item)} />
        </View>
      ))}
      {attention.length > 0 ? (
        <Text accessibilityRole="header" className="text-xl font-semibold text-text">
          Needs attention
        </Text>
      ) : null}
      {attention.map((item) => (
        <View key={item.id} className="gap-2 rounded-lg border border-danger bg-surface p-4">
          <Text className="font-semibold text-text">{describe(item)}</Text>
          {item.error ? <Text className="text-text-muted">{item.error}</Text> : null}
          <View className="flex-row gap-6">
            <TextLink
              title="Try again"
              onPress={() => {
                void outbox.retry(item.id).then(kickSync);
              }}
            />
            <TextLink title="Remove" onPress={() => confirmRemove(item)} />
          </View>
        </View>
      ))}
    </Screen>
  );
}
