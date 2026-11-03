// A suggested spot: the user's first favourite spot that still exists. Hidden when there is none.

import type { SpotDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

export function SpotCard({ spots }: { spots: SpotDto[] | undefined }) {
  const pick = spots?.find((s) => s.favourite && !s.unavailable && s.name);
  if (!pick) return null;
  return (
    <View className="gap-0.5 rounded-lg bg-surface px-4 py-3">
      <Text className="text-xs font-semibold uppercase text-text-muted">Suggested spot</Text>
      <Text numberOfLines={1} className="text-base text-text">{pick.name}</Text>
    </View>
  );
}
