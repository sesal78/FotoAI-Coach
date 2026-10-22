// One Google place: facts, a photo with attributions, today's light and weather, "Best light and
// angles", Google Maps, and saving it to My spots. Nothing here is stored except the spot itself.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';

import { useAddSpot, useDeleteSpot, useExplainPlace, usePlace, usePreferences, useUpdateSpot } from '../../data/hooks';
import { distanceM, distanceText } from '../../lib/distance';
import { useWhere } from '../../lib/where';
import { ExplainCard } from '../../ui/explore/ExplainCard';
import { PlacePhoto } from '../../ui/explore/PlacePhoto';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';
import { ErrorState, errorText, Loading } from '../../ui/states';
import { LightCard } from '../../ui/today/LightCard';
import { WeatherCard } from '../../ui/today/WeatherCard';

const typeName = (t: string | null) => (t ? t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null);

export default function PlaceScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const query = usePlace(placeId);
  const explain = useExplainPlace(placeId);
  const units = usePreferences().data?.units ?? 'metric';
  const { where } = useWhere();
  const add = useAddSpot();
  const update = useUpdateSpot();
  const remove = useDeleteSpot();
  const [notes, setNotes] = useState('');

  const saved = query.data?.spot ?? null;
  useEffect(() => setNotes(saved?.notes ?? ''), [saved?.id, saved?.notes]);

  if (query.isPending) {
    return (
      <Screen title="Place">
        <TextLink title="Back" onPress={() => router.back()} />
        <Loading label="Loading the place…" />
      </Screen>
    );
  }
  if (query.isError && !query.data) {
    return (
      <Screen title="Place">
        <TextLink title="Back" onPress={() => router.back()} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const { place, light, weather } = query.data;
  const away = where.state === 'ready' ? distanceText(distanceM(where.at, place.location)) : null;
  const confirmRemove = () =>
    Alert.alert('Remove from My spots?', `${place.name} and your notes leave My spots.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(saved!.id) },
    ]);
  const writeError = add.error ?? update.error ?? remove.error;

  return (
    <Screen title={place.name}>
      <TextLink title="Back" onPress={() => router.back()} />
      <Text className="text-text-muted">{[typeName(place.primaryType), away ? `${away} away` : null].filter(Boolean).join(' · ')}</Text>
      {place.formattedAddress ? <Text className="text-text">{place.formattedAddress}</Text> : null}
      <PlacePhoto placeId={place.placeId} photo={place.photos[0] ?? place.photo} placeName={place.name} />
      <LightCard light={light} now={new Date()} place={place.name} />
      <WeatherCard weather={weather} units={units} />
      <ExplainCard query={explain} />
      <PrimaryButton title="Plan a shoot here" onPress={() => router.navigate(`/shoot?placeId=${encodeURIComponent(place.placeId)}`)} />
      {place.googleMapsUri ? <TextLink title="Open in Google Maps" onPress={() => void Linking.openURL(place.googleMapsUri!)} /> : null}

      <View className="gap-3 rounded-lg bg-surface p-4">
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="What to shoot here, when, from where" multiline maxLength={2000} />
        {saved ? (
          <>
            <PrimaryButton title="Save notes" busy={update.isPending} onPress={() => update.mutate({ id: saved.id, patch: { notes: notes.trim() || null } })} />
            <TextLink
              title={saved.favourite ? 'Remove from favourites' : 'Add to favourites'}
              onPress={() => update.mutate({ id: saved.id, patch: { favourite: !saved.favourite } })}
            />
            <TextLink title="Remove from My spots" onPress={confirmRemove} />
          </>
        ) : (
          <PrimaryButton
            title="Save to My spots"
            busy={add.isPending}
            onPress={() => add.mutate({ placeId: place.placeId, ...(notes.trim() ? { notes: notes.trim() } : {}) })}
          />
        )}
        {writeError ? <Notice tone="error" text={errorText(writeError)} /> : null}
      </View>
    </Screen>
  );
}
