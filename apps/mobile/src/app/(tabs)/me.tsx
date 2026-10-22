// Me: XP, level and streak, and the way into skills, gear, the loadout and settings.

import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useSession } from '../../auth/session';
import { useMe } from '../../data/hooks';
import { PrimaryButton, Screen } from '../../ui/form';
import { ProgressCard } from '../../ui/me/ProgressCard';
import { ErrorState } from '../../ui/states';
import { THEME_LABELS, useTheme, type ThemeSetting } from '../../ui/ThemeProvider';

const CHOICES: ThemeSetting[] = ['auto', 'golden', 'golden_dark', 'camera'];

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
  const { signOut } = useSession();
  const { setting, setSetting } = useTheme();
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

      <View className="gap-2 rounded-lg bg-surface p-4">
        <Text className="text-lg font-semibold text-text">Appearance</Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {CHOICES.map((choice) => {
            const selected = choice === setting;
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setSetting(choice)}
                className={`rounded-pill border px-4 py-2 ${selected ? 'border-primary bg-primary' : 'border-border bg-surface-alt'}`}
              >
                <Text className={selected ? 'font-semibold text-on-primary' : 'text-text'}>{THEME_LABELS[choice]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <PrimaryButton title="Sign out" onPress={() => void signOut()} />
    </Screen>
  );
}
