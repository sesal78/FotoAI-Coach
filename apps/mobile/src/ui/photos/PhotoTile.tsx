// A square in the Photos grid: a photo on FotoAI (opens the photo screen), or one still on the
// phone, waiting to upload or refused by the server ("Needs attention" opens the changes screen).

import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import type { OutboxItem } from '../../data/outbox';
import type { PhotoBody } from '../../data/upload';
import { PhotoImage } from './PhotoImage';

export function PhotoTile({ id, size }: { id: string; size: number }) {
  return (
    <Pressable testID={`photo-tile-${id}`} accessibilityRole="button" accessibilityLabel="Open the photo" onPress={() => router.push(`/photo/${id}`)}>
      <PhotoImage id={id} label="A photo" style={{ width: size, height: size, borderRadius: 8 }} />
    </Pressable>
  );
}

export function WaitingTile({ item, body, size }: { item: OutboxItem; body: PhotoBody; size: number }) {
  const attention = item.state === 'attention';
  const picture = (
    <View style={{ width: size, height: size }} className="overflow-hidden rounded-lg">
      <Image accessibilityLabel="A photo waiting to upload" source={{ uri: body.file }} style={{ width: size, height: size, opacity: 0.6 }} contentFit="cover" cachePolicy="none" />
      <View className={`absolute bottom-0 left-0 right-0 px-1 py-1 ${attention ? 'bg-danger' : 'bg-surface'}`}>
        <Text className={`text-center text-xs font-semibold ${attention ? 'text-on-primary' : 'text-text'}`}>{attention ? 'Needs attention' : 'Waiting to upload'}</Text>
      </View>
    </View>
  );
  if (!attention) return picture;
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Opens the changes waiting to send" onPress={() => router.push('/me/sync')}>
      {picture}
    </Pressable>
  );
}
