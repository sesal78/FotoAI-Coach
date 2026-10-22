// One Google place photo with its authors' attributions (required by the Google Maps Platform
// terms). The short-lived link is fetched when the screen opens and kept in memory only.

import type { PhotoRef } from '@fotoai/contracts';
import { Image } from 'expo-image';
import { Linking, Pressable, Text, View } from 'react-native';

import { usePlacePhoto } from '../../data/hooks';
import { errorText, Loading } from '../states';

export function PlacePhoto({ placeId, photo, placeName }: { placeId: string; photo: PhotoRef | null; placeName: string }) {
  const link = usePlacePhoto(placeId, photo?.name ?? null);
  if (!photo) return null;
  return (
    <View className="gap-1">
      {link.isLoading ? <Loading label="Loading the photo…" /> : null}
      {link.isError ? <Text className="text-text-muted">{`Photo unavailable: ${errorText(link.error)}`}</Text> : null}
      {link.data ? (
        <Image
          accessibilityLabel={`Photo of ${placeName}`}
          source={{ uri: link.data.photoUri }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : null}
      {photo.attributions.map((a) =>
        a.uri ? (
          <Pressable key={a.displayName} accessibilityRole="link" onPress={() => void Linking.openURL(a.uri!)}>
            <Text className="text-xs text-primary">{`Photo: ${a.displayName}`}</Text>
          </Pressable>
        ) : (
          <Text key={a.displayName} className="text-xs text-text-muted">{`Photo: ${a.displayName}`}</Text>
        ),
      )}
    </View>
  );
}
