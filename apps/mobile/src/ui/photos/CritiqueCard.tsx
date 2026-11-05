// A critique: the 4 scores, the feedback on each, the strengths, the improvements and the settings
// the AI suggests.

import type { CritiqueDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { Bullets, Label } from './EditingCard';

export function CritiqueCard({ critique: c }: { critique: CritiqueDto }) {
  const scores = [`Overall ${c.overallScore}`, `Technical ${c.technicalScore}`, `Composition ${c.compositionScore}`, `Creative ${c.creativeScore}`];
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {scores.map((s, i) => (
          <Text key={s} className={`rounded-pill px-3 py-1 ${i === 0 ? 'bg-primary font-semibold text-on-primary' : 'bg-surface-alt text-text'}`}>
            {s}
          </Text>
        ))}
      </View>
      <Label text="Technical" />
      <Text className="text-text">{c.technicalFeedback}</Text>
      <Label text="Composition" />
      <Text className="text-text">{c.compositionFeedback}</Text>
      <Label text="Creative" />
      <Text className="text-text">{c.creativeFeedback}</Text>
      <Bullets title="Strengths" items={c.strengths} />
      <Bullets title="To improve" items={c.improvements} />
      {c.suggestedSettings ? (
        <>
          <Label text="Try these settings" />
          <Text className="text-text">{c.suggestedSettings}</Text>
        </>
      ) : null}
    </View>
  );
}
