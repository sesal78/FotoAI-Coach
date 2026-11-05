// The grid of ready photos, 3 across. Only the squares in view are drawn (and ask for a link); the
// next page loads near the end. Everything above the grid comes in as the header.

import type { PhotoDto } from '@fotoai/contracts';
import type { ReactElement } from 'react';
import { FlatList, useWindowDimensions } from 'react-native';

import { PhotoTile } from './PhotoTile';

export const GRID_COLUMNS = 3;
const PAD = 20;
const GAP = 6;

export function useTileSize(): number {
  const { width } = useWindowDimensions();
  return Math.floor((width - PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
}

export function PhotoGrid({ photos, header, onEnd }: { photos: PhotoDto[]; header: ReactElement; onEnd: () => void }) {
  const size = useTileSize();
  return (
    <FlatList
      testID="photo-grid"
      data={photos}
      keyExtractor={(p) => p.id}
      numColumns={GRID_COLUMNS}
      renderItem={({ item }) => <PhotoTile id={item.id} size={size} />}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={{ marginBottom: 12, gap: 16 }}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ padding: PAD, paddingBottom: 128, gap: GAP }}
      onEndReached={onEnd}
      onEndReachedThreshold={0.5}
      initialNumToRender={12}
      windowSize={5}
    />
  );
}
