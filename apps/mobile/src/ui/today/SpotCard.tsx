// A suggested spot: the user's first favourite spot that still exists. Hidden when there is none.

import type { SpotDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

export function SpotCard({ spots }: { spots: SpotDto[] | undefined }) {
  const pick = spots?.find((s) => s.favourite && !s.unavailable && s.name);
  if (!pick) return null;
  return (
    <View className="gap-1 rounded-lg bg-surface p-4">
      <Text className="text-sm font-semibold uppercase text-text-muted">Suggested spot</Text>
      <Text className="text-lg text-text">{pick.name}</Text>
    </View>
  );
}
