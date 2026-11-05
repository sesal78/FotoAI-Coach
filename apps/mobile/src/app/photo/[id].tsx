// One photo: the picture, what the AI check found, the camera data, where it was taken ("Near" the
// plan's place when it is linked to a step, otherwise the coordinates) and the linked step.
// It opens from the saved library with no signal; only the picture needs one.

import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { useLinkedStep, usePhoto } from '../../data/photos';
import { Screen, TextLink } from '../../ui/form';
import { CheckBadge } from '../../ui/photos/CheckBadge';
import { ExifCard } from '../../ui/photos/ExifCard';
import { PhotoImage } from '../../ui/photos/PhotoImage';
import { ErrorState, isOffline, Loading, OfflineBanner } from '../../ui/states';

const coords = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = usePhoto(id);
  const photo = query.data?.photo;
  const linked = useLinkedStep(photo?.stepId ?? null);

  if (!photo) {
    return (
      <Screen title="Photo">
        <TextLink title="Back" onPress={() => router.back()} />
        {query.isPending ? <Loading label="Loading the photo…" /> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      </Screen>
    );
  }

  const place = linked?.placeName ? `Near ${linked.placeName}` : photo.lat !== null && photo.lng !== null ? coords(photo.lat, photo.lng) : null;
  return (
    <Screen title="Photo">
      <TextLink title="Back" onPress={() => router.back()} />
      {query.error && isOffline(query.error) ? <OfflineBanner onRetry={() => void query.refetch()} /> : null}
      <PhotoImage id={photo.id} label="Your photo" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }} />
      <CheckBadge check={photo.check} />
      <ExifCard photo={photo} />
      {place ? <Text className="text-text">{place}</Text> : null}
      {linked ? <TextLink title={`Step: ${linked.title}`} onPress={() => router.push(`/plan/${linked.planId}`)} /> : null}
    </Screen>
  );
}
