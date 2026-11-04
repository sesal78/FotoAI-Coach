// The active challenge with Continue, or New challenge when there is none.

import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useActiveChallenge, useNewChallenge } from '../../data/hooks';
import { PrimaryButton, Notice } from '../form';
import { LastUpdated } from '../LastUpdated';
import { ErrorState, errorText, Loading } from '../states';

export function ChallengeCard() {
  const active = useActiveChallenge();
  const create = useNewChallenge();

  if (active.isPending) return <Loading label="Loading your challenge…" />;
  if (active.isError && !active.data) return <ErrorState error={active.error} onRetry={() => void active.refetch()} />;
  const current = active.data?.challenge ?? null;

  // One row (words left, button right), so Today fits on one screen.
  return (
    <View className="gap-2 rounded-lg bg-surface px-4 py-3">
      {current ? (
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-xs font-semibold uppercase text-text-muted">Active challenge</Text>
            <Text numberOfLines={2} className="text-base text-text">{current.challengeText}</Text>
          </View>
          <PrimaryButton small title="Continue" onPress={() => router.push(`/challenge/${current.id}`)} />
        </View>
      ) : (
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold text-text">No active challenge</Text>
            <Text numberOfLines={2} className="text-sm text-text-muted">Get one made for your gear and your skills.</Text>
          </View>
          <PrimaryButton small title="New challenge" busy={create.isPending} onPress={() => create.mutate({})} />
        </View>
      )}
      {!current && create.isError ? <Notice tone="error" text={errorText(create.error)} /> : null}
      <LastUpdated at={active.dataUpdatedAt} />
    </View>
  );
}
