// Settings: appearance (saved to the phone at once, then to the account), units, the home area
// from the phone's location, and sign out.

import type { Units } from '@fotoai/contracts';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useSession } from '../../auth/session';
import { usePatchPreferences, usePreferences } from '../../data/hooks';
import { phoneLocation, type LatLng } from '../../lib/where';
import { Choice } from '../../ui/Choice';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';
import { ErrorState, errorText, Loading } from '../../ui/states';
import { clearThemeUnsaved, markThemeUnsaved, THEME_LABELS, useTheme, type ThemeSetting } from '../../ui/ThemeProvider';

const THEMES: ThemeSetting[] = ['golden', 'golden_dark', 'camera', 'auto'];
const UNITS: Array<{ value: Units; label: string }> = [
  { value: 'metric', label: 'Metric (°C, km/h)' },
  { value: 'imperial', label: 'Imperial (°F, mph)' },
];
const LOCATION_HINT = 'Allow location for FotoAI in Android Settings > Apps > FotoAI > Permissions, then try again.';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      <Text accessibilityRole="header" className="text-lg font-semibold text-text">{title}</Text>
      {children}
    </View>
  );
}

export default function Settings() {
  const { signOut } = useSession();
  const { setting, setSetting } = useTheme();
  const prefs = usePreferences();
  const saveTheme = usePatchPreferences();
  const saveOther = usePatchPreferences();
  const [unsavedTheme, setUnsavedTheme] = useState<ThemeSetting | null>(null);
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [label, setLabel] = useState('');
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState(false);

  const pushTheme = (t: ThemeSetting) => {
    setUnsavedTheme(null);
    markThemeUnsaved(t);
    saveTheme.mutate({ theme: t }, { onSuccess: clearThemeUnsaved, onError: () => setUnsavedTheme(t) });
  };

  const locate = async () => {
    setHint(false);
    setLocating(true);
    const at = await phoneLocation();
    setLocating(false);
    if (!at) return setHint(true);
    setDraft(at);
    setLabel(prefs.data?.home?.label ?? '');
  };

  const home = prefs.data?.home ?? null;

  return (
    <Screen title="Settings">
      <TextLink title="Back" onPress={() => router.back()} />

      <Section title="Appearance">
        <Choice
          label="Theme"
          options={THEMES.map((t) => ({ value: t, label: THEME_LABELS[t] }))}
          selected={setting}
          onSelect={(t) => {
            setSetting(t);
            pushTheme(t);
          }}
        />
        {unsavedTheme ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="flex-row items-center justify-between rounded-md bg-surface-alt p-3">
            <Text className="flex-1 text-text">Not saved to your account</Text>
            <Pressable accessibilityRole="button" onPress={() => pushTheme(unsavedTheme)} className="min-h-11 justify-center px-3">
              <Text className="font-semibold text-primary">Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </Section>

      {prefs.isPending ? <Loading label="Loading your settings…" /> : null}
      {prefs.isError && !prefs.data ? <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} /> : null}
      {prefs.data ? (
        <>
          <Section title="Units">
            <Choice label="Units" options={UNITS} selected={prefs.data.units} onSelect={(u) => saveOther.mutate({ units: u })} />
          </Section>

          <Section title="Home area">
            <Text className="text-text">
              {home ? `${home.label || 'Home area'} (${home.lat.toFixed(3)}, ${home.lng.toFixed(3)})` : 'Not set. Today then uses where you are.'}
            </Text>
            {draft ? (
              <>
                <Text className="text-text-muted">{`Found you at ${draft.lat.toFixed(3)}, ${draft.lng.toFixed(3)}.`}</Text>
                <Field label="Home area name" value={label} onChangeText={setLabel} placeholder="Such as Brunswick" maxLength={120} />
                <PrimaryButton
                  title="Save home area"
                  busy={saveOther.isPending}
                  onPress={() => saveOther.mutate({ home: { lat: draft.lat, lng: draft.lng, label: label.trim() || null } }, { onSuccess: () => setDraft(null) })}
                />
              </>
            ) : (
              <PrimaryButton title="Use my location" busy={locating} onPress={() => void locate()} />
            )}
            {hint ? <Notice text={LOCATION_HINT} /> : null}
            {home ? <TextLink title="Clear" onPress={() => saveOther.mutate({ home: null })} /> : null}
          </Section>
          {saveOther.isError ? <Notice tone="error" text={errorText(saveOther.error)} /> : null}
        </>
      ) : null}

      <PrimaryButton title="Sign out" onPress={() => void signOut()} />
    </Screen>
  );
}
