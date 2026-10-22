// Sends a signed-in user with no gear to Onboarding, once per account on this phone.

import { Redirect } from 'expo-router';

import { useMe, useMyGear } from '../data/hooks';
import { isOnboarded } from '../lib/onboarding';

export function OnboardingGate() {
  const me = useMe();
  const gear = useMyGear();
  if (!me.data || !gear.data) return null;
  if (gear.data.items.length > 0 || isOnboarded(me.data.userId)) return null;
  return <Redirect href="/onboarding" />;
}
