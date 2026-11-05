// How to recreate a shot: the settings, the light, where the camera was, the recipe (the steps in
// order), the gear and the edit.

import type { RecreateDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { Bullets, Label } from './EditingCard';

const DIFFICULTY = { beginner: 'Easy to recreate', intermediate: 'Some skill needed', advanced: 'Hard to recreate' } as const;

export function RecreateCard({ recreate: r }: { recreate: RecreateDto }) {
  const s = r.estimatedSettings;
  const light = r.lightingAnalysis;
  return (
    <View className="gap-2">
      <Text className="text-text-muted">{DIFFICULTY[r.difficultyToRecreate]}</Text>
      <Label text="Settings" />
      <Text className="text-text">{[`ISO ${s.iso}`, s.aperture, s.shutterSpeed, s.focalLength, s.meteringMode].filter(Boolean).join(' · ')}</Text>
      <Label text="Light" />
      <Text className="text-text">{[light.timeOfDay, light.lightType, light.lightDirection].filter(Boolean).join(' · ')}</Text>
      {light.modifiers ? <Text className="text-text-muted">{`Modifiers: ${light.modifiers}`}</Text> : null}
      <Label text="Position" />
      <Text className="text-text">{r.cameraPosition}</Text>
      <Text className="text-text-muted">{`Lens: ${r.lensType}`}</Text>
      {r.shotRecipe.length ? <Label text="Recipe" /> : null}
      {r.shotRecipe.map((step, i) => (
        <Text key={`${i}-${step}`} className="text-text">{`${i + 1}. ${step}`}</Text>
      ))}
      <Bullets title="Gear" items={r.gearNeeded} />
      {r.postProcessing ? (
        <>
          <Label text="Edit" />
          <Text className="text-text">{r.postProcessing}</Text>
        </>
      ) : null}
    </View>
  );
}
