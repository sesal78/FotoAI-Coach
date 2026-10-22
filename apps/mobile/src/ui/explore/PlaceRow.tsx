// One row in the Explore list: a Google place or one of the user's spots, with its distance.

import { Pressable, Text, View } from 'react-native';

export interface ExploreItem {
  kind: 'place' | 'spot';
  id: string;
  name: string;
  location: { lat: number; lng: number };
  type: string | null;
  distance: string | null;
}

const typeName = (t: string | null) => (t ? t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null);

export function PlaceRow({ item, onPress }: { item: ExploreItem; onPress: () => void }) {
  const kind = item.kind === 'spot' ? 'My spot' : typeName(item.type);
  const label = [item.name, kind && item.kind === 'spot' ? kind : null, item.distance].filter(Boolean).join(', ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="min-h-12 flex-row items-center justify-between rounded-md bg-surface p-3">
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-text">{item.name}</Text>
        {kind ? <Text className={item.kind === 'spot' ? 'text-sm font-semibold text-accent' : 'text-sm text-text-muted'}>{kind}</Text> : null}
      </View>
      {item.distance ? <Text className="text-text-muted">{item.distance}</Text> : null}
    </Pressable>
  );
}
