// The film roll in the camera: its stock and the next frame. Shown at the top of Shoot.

import type { RollDto } from '@fotoai/contracts';
import { Pressable, Text } from 'react-native';

export const rollCounter = (roll: Pick<RollDto, 'framesLogged' | 'exposures'>) =>
  roll.framesLogged >= roll.exposures ? `roll full (${roll.exposures} frames)` : `frame ${roll.framesLogged + 1} of ${roll.exposures}`;

export function RollCard({ roll, onPress }: { roll: RollDto; onPress: () => void }) {
  const line = `${roll.stockName} · ${rollCounter(roll)}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Film loaded: ${line}`} onPress={onPress} className="min-h-12 gap-1 rounded-lg border border-accent bg-surface p-4">
      <Text className="text-sm font-semibold text-accent">Film loaded</Text>
      <Text className="font-semibold text-text">{line}</Text>
    </Pressable>
  );
}
