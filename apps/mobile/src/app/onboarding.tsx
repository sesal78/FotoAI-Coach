// First run: add the gear Seun carries, then set the home area. Either step can be skipped; once
// done or skipped, it does not come back for this account on this phone.

import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useMe, usePatchPreferences } from '../data/hooks';
import { markOnboarded } from '../lib/onboarding';
import { phoneLocation } from '../lib/where';
import { CatalogList } from '../ui/gear/CatalogList';
import { Notice, PrimaryButton, Screen, TextLink } from '../ui/form';
import { errorText } from '../ui/states';

export default function Onboarding() {
  const me = useMe();
  const saveHome = usePatchPreferences();
  const [step, setStep] = useState<'gear' | 'home'>('gear');
  const [hint, setHint] = useState(false);
  const [locating, setLocating] = useState(false);

  const finish = () => {
    if (me.data) markOnboarded(me.data.userId);
    router.replace('/today');
  };

  const saveLocation = async () => {
    setHint(false);
    setLocating(true);
    const at = await phoneLocation();
    setLocating(false);
    if (!at) return setHint(true);
    saveHome.mutate({ home: { lat: at.lat, lng: at.lng, label: null } }, { onSuccess: finish });
  };

  if (step === 'gear') {
    return (
      <Screen title="Your gear">
        <Text className="text-text">Add the cameras and lenses you carry. Plans and challenges then fit your kit.</Text>
        <CatalogList />
        <TextLink title="Add custom gear" onPress={() => router.push('/me/gear/custom')} />
        <PrimaryButton title="Next" onPress={() => setStep('home')} />
        <TextLink title="Skip for now" onPress={finish} />
      </Screen>
    );
  }

  return (
    <Screen title="Your home area">
      <Text className="text-text">Today shows the light and weather for your home area. You can change it later in Settings.</Text>
      <PrimaryButton title="Use my location" busy={locating || saveHome.isPending} onPress={() => void saveLocation()} />
      {hint ? <Notice text="Location is off for FotoAI. You can allow it in Android Settings, or set the home area later." /> : null}
      {saveHome.isError ? <Notice tone="error" text={errorText(saveHome.error)} /> : null}
      <TextLink title="Skip for now" onPress={finish} />
    </Screen>
  );
}
