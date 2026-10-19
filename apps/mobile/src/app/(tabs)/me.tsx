import { MeResponse } from '@fotoai/contracts';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import { useSession } from '../../auth/session';
import { getApi } from '../../data/client';
import { PrimaryButton, Screen } from '../../ui/form';
import { ErrorState, Loading } from '../../ui/states';
import { THEME_LABELS, useTheme, type ThemeSetting } from '../../ui/ThemeProvider';

const CHOICES: ThemeSetting[] = ['auto', 'golden', 'golden_dark', 'camera'];

export default function Me() {
  const { signOut } = useSession();
  const { setting, setSetting } = useTheme();
  const me = useQuery({ queryKey: ['me'], queryFn: () => getApi().request('/api/v2/me', { schema: MeResponse }) });

  return (
    <Screen title="Me">
      {me.isPending ? <Loading /> : null}
      {me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : null}
      {me.data ? <Text className="text-text">Signed in as {me.data.email ?? 'your account'}</Text> : null}

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
