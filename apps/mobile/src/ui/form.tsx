// Shared form parts for the account screens and later forms.

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './ThemeProvider';

export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerClassName="gap-4 p-5 pb-32" keyboardShouldPersistTaps="handled">
        {title ? <Text accessibilityRole="header" className="text-3xl font-bold text-text">{title}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  const { tokens } = useTheme();
  return (
    <View className="gap-1">
      <Text className="font-semibold text-text">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={tokens.colors.textMuted}
        className="rounded-md border border-border bg-surface px-4 py-3 text-base text-text"
        {...input}
      />
    </View>
  );
}

export function PrimaryButton({ title, onPress, busy = false }: { title: string; onPress: () => void; busy?: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      className="items-center rounded-pill bg-primary px-5 py-3"
    >
      {busy ? <ActivityIndicator color={tokens.colors.onPrimary} /> : <Text className="text-base font-semibold text-on-primary">{title}</Text>}
    </Pressable>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="py-1">
      <Text className="font-semibold text-primary">{title}</Text>
    </Pressable>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'success' }) {
  const color = tone === 'error' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-text';
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'text'} className="rounded-md bg-surface p-3">
      <Text className={color}>{text}</Text>
    </View>
  );
}
