// One of the user's photos, through its signed read link. The link lives in memory only. When the
// picture fails to load (most often a link that ran out), a new link is fetched once. With no
// signal the picture says it needs one; the rest of the screen still works from saved reads.

import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View, type StyleProp } from 'react-native';

import { usePhotoUrl } from '../../data/photos';
import { isOffline } from '../states';

export function PhotoImage({ id, label, style }: { id: string; label: string; style: StyleProp<ImageStyle> }) {
  const link = usePhotoUrl(id);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = link.data?.url ?? null;

  if (!url || (failedUrl === url && !link.isFetching)) {
    const text = link.isPending || link.isFetching ? 'Loading…' : isOffline(link.error) ? 'Needs a signal' : 'Picture unavailable';
    return (
      <View style={style as object} className="items-center justify-center bg-surface-alt">
        <Text className="text-center text-xs text-text-muted">{text}</Text>
        {text === 'Picture unavailable' ? (
          <Pressable accessibilityRole="button" onPress={() => void link.refetch()}>
            <Text className="text-xs font-semibold text-primary">Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={label}
      // The cache key is the photo, not the link: a new link for the same photo reuses the bytes.
      source={{ uri: url, cacheKey: `fotoai-photo-${id}` }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => {
        // A second failure on a fresh link shows "Picture unavailable" with Try again.
        if (failedUrl) setFailedUrl(url);
        else {
          setFailedUrl(url);
          void link.refetch();
        }
      }}
    />
  );
}
