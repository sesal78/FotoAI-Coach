// Shoot: the film roll in the camera, New plan for the place handed over from Explore ("Plan a
// shoot here" sends `placeId` or `spotId`), and my plans, active first. Plans open with no signal.

import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { usePlans, useRolls } from '../../data/shoot';
import { Screen, TextLink } from '../../ui/form';
import { NewPlan } from '../../ui/shoot/NewPlan';
import { PlanRow } from '../../ui/shoot/PlanRow';
import { RollCard } from '../../ui/shoot/RollCard';
import { Empty, ErrorState, Loading } from '../../ui/states';

const ORDER = { active: 0, done: 1, archived: 2 } as const;

export default function Shoot() {
  const { placeId, spotId } = useLocalSearchParams<{ placeId?: string; spotId?: string }>();
  const plans = usePlans();
  const loaded = useRolls().rolls.find((r) => r.status === 'loaded');
  const list = (plans.data?.plans ?? []).filter((p) => p.status !== 'archived').sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return (
    <Screen title="Shoot">
      {loaded ? <RollCard roll={loaded} onPress={() => router.push(`/roll/${loaded.id}`)} /> : null}
      {placeId || spotId ? (
        <NewPlan placeId={placeId} spotId={spotId} />
      ) : (
        <View className="gap-2 rounded-lg bg-surface p-4">
          <Text className="text-text-muted">To plan a shoot, choose a place first.</Text>
          <TextLink title="Pick a place in Explore" onPress={() => router.navigate('/explore')} />
        </View>
      )}

      <Text accessibilityRole="header" className="text-xl font-semibold text-text">
        My plans
      </Text>
      {plans.isPending ? <Loading label="Loading your plans…" /> : null}
      {plans.isError && !plans.data ? <ErrorState error={plans.error} onRetry={() => void plans.refetch()} /> : null}
      {plans.isSuccess && list.length === 0 ? <Empty title="No plans yet" hint="Pick a place in Explore and tap Plan a shoot here." /> : null}
      {list.map((plan) => (
        <PlanRow key={plan.id} plan={plan} onPress={() => router.push(`/plan/${plan.id}`)} />
      ))}
    </Screen>
  );
}
