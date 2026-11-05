// Editing tips: a summary, the steps in order (tool, change, why) and the film look.

import type { EditingDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

export function Label({ text }: { text: string }) {
  return <Text className="text-sm font-semibold uppercase text-text-muted">{text}</Text>;
}

/** A titled list with a bullet on each line. Nothing shows when the list is empty. */
export function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <>
      <Label text={title} />
      {items.map((item, i) => (
        <Text key={`${i}-${item}`} className="text-text">{`• ${item}`}</Text>
      ))}
    </>
  );
}

export function EditingCard({ editing: e }: { editing: EditingDto }) {
  return (
    <View className="gap-2">
      <Text className="text-text">{e.summary}</Text>
      {e.steps.map((s, i) => (
        <View key={`${i}-${s.tool}`} className="gap-0.5">
          <Text className="font-semibold text-text">{`${i + 1}. ${s.tool}: ${s.change}`}</Text>
          <Text className="text-text-muted">{s.why}</Text>
        </View>
      ))}
      {e.filmSimulation ? <Text className="text-text">{`Film look: ${e.filmSimulation}`}</Text> : null}
    </View>
  );
}
