// A choice chip (the same look as Explore's type chips).

import { Pressable, Text } from 'react-native';

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`min-h-11 justify-center rounded-pill border px-4 ${on ? 'border-primary bg-primary' : 'border-border bg-surface-alt'}`}
    >
      <Text className={on ? 'font-semibold text-on-primary' : 'text-text'}>{label}</Text>
    </Pressable>
  );
}
