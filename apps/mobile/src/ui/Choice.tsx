// A row of radio chips: one choice from a short list (theme, body, lens, gear kind).

import { Pressable, Text, View } from 'react-native';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export function Choice<T extends string>({ options, selected, onSelect, label }: { options: ChoiceOption<T>[]; selected: T | null; onSelect: (v: T) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === selected;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onSelect(o.value)}
            className={`min-h-11 justify-center rounded-pill border px-4 py-2 ${on ? 'border-primary bg-primary' : 'border-border bg-surface-alt'}`}
          >
            <Text className={on ? 'font-semibold text-on-primary' : 'text-text'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
