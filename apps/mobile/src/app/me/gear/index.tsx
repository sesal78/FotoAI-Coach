// My gear: the user's cameras and lenses. Remove asks first.

import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { useDeleteGear, useMyGear } from '../../../data/hooks';
import { Notice, Screen, TextLink } from '../../../ui/form';
import { LastUpdated } from '../../../ui/LastUpdated';
import { Empty, ErrorState, errorText, Loading } from '../../../ui/states';

const KIND = { body: 'Camera', lens: 'Lens', other: 'Other' } as const;

export default function MyGear() {
  const gear = useMyGear();
  const remove = useDeleteGear();

  const confirmRemove = (id: string, name: string) =>
    Alert.alert('Remove gear?', `${name} leaves your gear. A loadout that uses it is cleared.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <Screen title="My gear">
      <TextLink title="Back" onPress={() => router.back()} />
      {gear.isPending ? <Loading label="Loading your gear…" /> : null}
      {gear.isError && !gear.data ? <ErrorState error={gear.error} onRetry={() => void gear.refetch()} /> : null}
      {gear.data && gear.data.items.length === 0 ? <Empty title="No gear yet" hint="Add your cameras and lenses so plans fit what you carry." /> : null}
      {gear.data?.items.map((g) => (
        <View key={g.id} className="flex-row items-center justify-between rounded-md bg-surface p-3">
          <View className="flex-1">
            <Text className="font-semibold text-text">{g.name}</Text>
            <Text className="text-text-muted">{g.capability ? KIND[g.kind] : `${KIND[g.kind]} · no capability data`}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${g.name}`} onPress={() => confirmRemove(g.id, g.name)} className="min-h-11 justify-center px-3">
            <Text className="font-semibold text-danger">Remove</Text>
          </Pressable>
        </View>
      ))}
      {remove.isError ? <Notice tone="error" text={errorText(remove.error)} /> : null}
      <TextLink title="Add from the catalog" onPress={() => router.push('/me/gear/add')} />
      <TextLink title="Add custom gear" onPress={() => router.push('/me/gear/custom')} />
      <LastUpdated at={gear.dataUpdatedAt} />
    </Screen>
  );
}
