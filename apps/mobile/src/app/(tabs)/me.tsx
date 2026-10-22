// Me: XP, level and streak, and the way into skills, gear, the loadout and settings (where
// Appearance and Sign out live).

import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useMe } from '../../data/hooks';
import { Screen } from '../../ui/form';
import { ProgressCard } from '../../ui/me/ProgressCard';
import { ErrorState } from '../../ui/states';
import { useTheme } from '../../ui/ThemeProvider';

const LINKS: Array<[string, Href]> = [
  ['Skills', '/me/skills'],
  ['My gear', '/me/gear'],
  ['Loadout', '/me/loadout'],
  ['Settings', '/me/settings'],
];

function LinkRow({ label, href }: { label: string; href: Href }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} className="min-h-12 flex-row items-center justify-between rounded-md bg-surface px-4 py-3">
      <Text className="text-base text-text">{label}</Text>
      <ChevronRight color={tokens.colors.textMuted} size={20} />
    </Pressable>
  );
}

export default function Me() {
  const me = useMe();

  return (
    <Screen title="Me">
      {me.isError && !me.data ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : null}
      {me.data ? <Text className="text-text">Signed in as {me.data.email ?? 'your account'}</Text> : null}

      <ProgressCard />

      <View className="gap-2">
        {LINKS.map(([label, href]) => (
          <LinkRow key={label} label={label} href={href} />
        ))}
      </View>
    </Screen>
  );
}
