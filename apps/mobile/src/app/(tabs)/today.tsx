// Today: the next good light where the user is, the weather, the active challenge, a suggested
// spot and a way into Shoot. Every section has its own loading, error and offline state.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useConditions, usePreferences, useSpots } from '../../data/hooks';
import { useWhere, type Where } from '../../lib/where';
import { PrimaryButton, Screen } from '../../ui/form';
import { LastUpdated, localDay } from '../../ui/LastUpdated';
import { ErrorState, Loading } from '../../ui/states';
import { ChallengeCard } from '../../ui/today/ChallengeCard';
import { LightCard } from '../../ui/today/LightCard';
import { SpotCard } from '../../ui/today/SpotCard';
import { WeatherCard } from '../../ui/today/WeatherCard';

/** The current time, updated every `everyMs`. */
function useNow(everyMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

function LightSection({ where }: { where: Extract<Where, { state: 'ready' }> }) {
  const now = useNow(60_000);
  const conditions = useConditions(where.at, localDay(now.getTime()));
  const units = usePreferences().data?.units ?? 'metric';
  if (conditions.isPending) return <Loading label="Loading the light…" />;
  if (conditions.isError && !conditions.data) return <ErrorState error={conditions.error} onRetry={() => void conditions.refetch()} />;
  return (
    <View className="gap-4">
      <LightCard light={conditions.data.light} now={now} place={where.label} />
      <WeatherCard weather={conditions.data.weather} units={units} />
      <LastUpdated at={conditions.dataUpdatedAt} />
    </View>
  );
}

function SetHomeCard({ onAsk }: { onAsk: () => void }) {
  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      <Text className="text-text-muted">Today shows the light and weather for your home area, or where you are when you allow location.</Text>
      <PrimaryButton title="Use my location" onPress={onAsk} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/me/settings')} className="min-h-11 justify-center">
        <Text className="text-lg font-semibold text-primary">Set your home area</Text>
      </Pressable>
    </View>
  );
}

export default function Today() {
  const { where, ask } = useWhere();
  const spots = useSpots();

  return (
    <Screen title="Today">
      {where.state === 'loading' ? <Loading label="Finding where you are…" /> : null}
      {where.state === 'none' ? <SetHomeCard onAsk={ask} /> : null}
      {where.state === 'ready' ? <LightSection where={where} /> : null}
      <ChallengeCard />
      <SpotCard spots={spots.data?.spots} />
      <PrimaryButton title="Plan my shoot" onPress={() => router.navigate('/shoot')} />
    </Screen>
  );
}
