// Sunny 16: pick the light and get an aperture and shutter speed at the film's rated ISO.

import { sunny16, type Scene } from '@fotoai/core';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Chip } from './Chip';

const SCENES: ReadonlyArray<readonly [Scene, string]> = [
  ['full_sun', 'Full sun'],
  ['snow_sand', 'Snow or sand'],
  ['slight_overcast', 'Light cloud'],
  ['overcast', 'Overcast'],
  ['heavy_overcast', 'Heavy cloud'],
  ['open_shade', 'Open shade'],
  ['golden_hour', 'Golden hour'],
  ['blue_hour', 'Blue hour'],
];

export function Sunny16({ iso, onPick }: { iso: number; onPick: (exposure: { aperture: number; shutterSeconds: number }) => void }) {
  const [scene, setScene] = useState<Scene | null>(null);
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-text-muted">{`Sunny 16 at ISO ${iso}`}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {SCENES.map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            on={scene === key}
            onPress={() => {
              setScene(key);
              const exposure = sunny16(key, iso);
              if (exposure) onPick(exposure);
            }}
          />
        ))}
      </ScrollView>
      {scene === 'blue_hour' ? <Text className="text-text-muted">Meter it: Sunny 16 does not cover this light.</Text> : null}
    </View>
  );
}
