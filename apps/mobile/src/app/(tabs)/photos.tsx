// Photos: Import photos, then the photos still on the phone (waiting to upload, or refused), then
// the grid of the photos on FotoAI. With no signal the saved grid still shows; an import made
// offline shows at once and is sent later.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useImport, usePhotos, useWaitingPhotos } from '../../data/photos';
import { Notice, PrimaryButton } from '../../ui/form';
import { PhotoGrid, useTileSize } from '../../ui/photos/PhotoGrid';
import { WaitingTile } from '../../ui/photos/PhotoTile';
import { Empty, ErrorState, isOffline, Loading, OfflineBanner } from '../../ui/states';

export default function Photos() {
  const list = usePhotos();
  const waiting = useWaitingPhotos();
  const { importPhotos, busy } = useImport();
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const size = useTileSize();

  const onImport = () => {
    setMessage(null);
    importPhotos()
      .then((r) => r.message && setMessage({ text: r.message, tone: r.failed && !r.added ? 'error' : 'info' }))
      .catch((err: unknown) => setMessage({ text: err instanceof Error ? err.message : 'The photos could not be imported.', tone: 'error' }));
  };

  const saved = list.data !== undefined;
  const header = (
    <View className="gap-4">
      <Text accessibilityRole="header" className="text-3xl font-bold text-text">
        Photos
      </Text>
      <PrimaryButton title="Import photos" onPress={onImport} busy={busy} />
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {saved && list.error && isOffline(list.error) ? <OfflineBanner onRetry={() => void list.refetch()} /> : null}
      {waiting.length > 0 ? (
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {waiting.map(({ item, body }) => (
            <WaitingTile key={item.id} item={item} body={body} size={size} />
          ))}
        </View>
      ) : null}
      {list.isPending ? <Loading label="Loading your photos…" /> : null}
      {!saved && list.error ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      {saved && list.error && !isOffline(list.error) ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      {saved && list.photos.length === 0 && waiting.length === 0 ? <Empty title="No photos yet" hint="Import photos from your gallery to get feedback on them." /> : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <PhotoGrid
        photos={list.photos}
        header={header}
        onEnd={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
      />
    </SafeAreaView>
  );
}
