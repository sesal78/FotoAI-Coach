// Shoot. Until 3E builds plans, it shows the place handed over from Explore ("Plan a shoot here")
// by `placeId` or `spotId`. 3E reads the same two parameters.

import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { usePlace, useSpots } from '../../data/hooks';
import { Screen } from '../../ui/form';
import { Empty } from '../../ui/states';

function ChosenPlace({ placeId }: { placeId: string }) {
  const place = usePlace(placeId);
  return place.data ? <Text className="text-lg font-semibold text-text">{`Planning: ${place.data.place.name}`}</Text> : null;
}

function ChosenSpot({ spotId }: { spotId: string }) {
  const name = useSpots().data?.spots.find((s) => s.id === spotId)?.name;
  return name ? <Text className="text-lg font-semibold text-text">{`Planning: ${name}`}</Text> : null;
}

export default function Shoot() {
  const { placeId, spotId } = useLocalSearchParams<{ placeId?: string; spotId?: string }>();
  const chosen = Boolean(placeId || spotId);
  return (
    <Screen title="Shoot">
      {chosen ? (
        <View className="gap-2 rounded-lg bg-surface p-4">
          {placeId ? <ChosenPlace placeId={placeId} /> : null}
          {spotId && !placeId ? <ChosenSpot spotId={spotId} /> : null}
          <Text className="text-text-muted">Shoot plans arrive in the next update. This place stays chosen here.</Text>
        </View>
      ) : (
        <Empty title="Coming soon" hint="Shoot plans and the film log arrive in a coming update." />
      )}
    </Screen>
  );
}
