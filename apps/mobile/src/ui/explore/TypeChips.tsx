// Place-type filters. Each chip is one of the server's photo types; tapping the chosen one clears it.

import { Pressable, ScrollView, Text } from 'react-native';

export const TYPE_CHIPS = [
  ['park', 'Parks'],
  ['beach', 'Beaches'],
  ['observation_deck', 'Lookouts'],
  ['historical_landmark', 'Landmarks'],
  ['garden', 'Gardens'],
  ['marina', 'Marinas'],
] as const;

export function TypeChips({ selected, onChange }: { selected: string | null; onChange: (type: string | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {TYPE_CHIPS.map(([type, label]) => {
        const on = selected === type;
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(on ? null : type)}
            className={`min-h-11 justify-center rounded-pill border px-4 ${on ? 'border-primary bg-primary' : 'border-border bg-surface-alt'}`}
          >
            <Text className={on ? 'font-semibold text-on-primary' : 'text-text'}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
