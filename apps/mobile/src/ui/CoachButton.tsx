// The Coach button floats on every tab. The chat itself arrives in sub-phase 3F.

import { MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { useTheme } from './ThemeProvider';

export function CoachButton() {
  const [open, setOpen] = useState(false);
  const { tokens } = useTheme();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the coach"
        onPress={() => setOpen(true)}
        className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-pill bg-primary"
      >
        <MessageCircle color={tokens.colors.onPrimary} size={26} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="gap-3 rounded-t-lg bg-surface p-6">
            <Text className="text-lg font-semibold text-text">Coach</Text>
            <Text className="text-text-muted">The coach chat arrives in a later update.</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} className="self-start rounded-pill bg-primary px-4 py-2">
              <Text className="font-semibold text-on-primary">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
