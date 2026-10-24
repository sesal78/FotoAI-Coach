// One of the user's spots: a pin (name and notes) or a saved Google place. Edit, favourite,
// "Best light and angles" from the spot endpoint, and remove (asks first).

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { useDeleteSpot, useExplainSpot, useSpots, useUpdateSpot } from '../../data/hooks';
import { distanceM, distanceText } from '../../lib/distance';
import { useWhere } from '../../lib/where';
import { ExplainCard } from '../../ui/explore/ExplainCard';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';
import { LastUpdated } from '../../ui/LastUpdated';
import { Empty, ErrorState, errorText, Loading } from '../../ui/states';

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spots = useSpots();
  const update = useUpdateSpot();
  const remove = useDeleteSpot();
  const explain = useExplainSpot(id);
  // Distances match Explore: from the phone when location is allowed, else the home area.
  const { where } = useWhere({ preferPhone: true });
  const spot = spots.data?.spots.find((s) => s.id === id) ?? null;
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setName(spot?.name ?? '');
    setNotes(spot?.notes ?? '');
  }, [spot?.id, spot?.name, spot?.notes]);

  const back = <TextLink title="Back" onPress={() => router.back()} />;
  if (spots.isPending) return <Screen title="My spot">{back}<Loading label="Loading your spot…" /></Screen>;
  if (spots.isError && !spots.data) return <Screen title="My spot">{back}<ErrorState error={spots.error} onRetry={() => void spots.refetch()} /></Screen>;
  if (!spot) return <Screen title="My spot">{back}<Empty title="This spot is gone" hint="It may have been removed on another device." /></Screen>;

  const isPin = spot.source === 'user';
  const away = where.state === 'ready' && spot.location ? distanceText(distanceM(where.at, spot.location)) : null;
  const confirmRemove = () =>
    Alert.alert('Remove this spot?', `${spot.name ?? 'This spot'} and its notes leave My spots.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(spot.id, { onSuccess: () => router.back() }) },
    ]);
  const save = () => {
    const patch: { name?: string; notes: string | null } = { notes: notes.trim() || null };
    if (isPin && name.trim() && name.trim() !== spot.name) patch.name = name.trim();
    update.mutate({ id: spot.id, patch });
  };

  return (
    <Screen title={spot.name ?? 'My spot'}>
      {back}
      {spot.unavailable ? <Notice text="Can't load this place from Google right now. It may be gone, or Google may be busy. Your notes are safe." /> : null}
      <Text className="text-text-muted">{[isPin ? 'My spot (pin)' : 'My spot (Google place)', away ? `${away} away` : null].filter(Boolean).join(' · ')}</Text>
      {!isPin && spot.placeId && !spot.unavailable ? <TextLink title="Open the place" onPress={() => router.push(`/place/${spot.placeId}`)} /> : null}
      <View className="gap-3 rounded-lg bg-surface p-4">
        {isPin ? <Field label="Name" value={name} onChangeText={setName} maxLength={80} /> : null}
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={2000} placeholder="What to shoot here, when, from where" />
        <PrimaryButton title="Save changes" busy={update.isPending} onPress={save} />
        <TextLink title={spot.favourite ? 'Remove from favourites' : 'Add to favourites'} onPress={() => update.mutate({ id: spot.id, patch: { favourite: !spot.favourite } })} />
        {update.isSuccess ? <Notice tone="success" text="Saved" /> : null}
        {update.isError ? <Notice tone="error" text={errorText(update.error)} /> : null}
      </View>
      {!spot.unavailable ? <ExplainCard query={explain} /> : null}
      {!spot.unavailable ? <PrimaryButton title="Plan a shoot here" onPress={() => router.navigate(`/shoot?spotId=${encodeURIComponent(spot.id)}`)} /> : null}
      <TextLink title="Remove this spot" onPress={confirmRemove} />
      {remove.isError ? <Notice tone="error" text={errorText(remove.error)} /> : null}
      <LastUpdated at={spots.dataUpdatedAt} />
    </Screen>
  );
}
