// The active challenge with Continue, or New challenge when there is none.

import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useActiveChallenge, useNewChallenge } from '../../data/hooks';
import { PrimaryButton, Notice } from '../form';
import { LastUpdated } from '../LastUpdated';
import { Empty, ErrorState, errorText, Loading } from '../states';

export function ChallengeCard() {
  const active = useActiveChallenge();
  const create = useNewChallenge();

  if (active.isPending) return <Loading label="Loading your challenge…" />;
  if (active.isError && !active.data) return <ErrorState error={active.error} onRetry={() => void active.refetch()} />;
  const current = active.data?.challenge ?? null;

  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      {current ? (
        <>
          <Text className="text-sm font-semibold uppercase text-text-muted">Active challenge</Text>
          <Text className="text-lg text-text">{current.challengeText}</Text>
          <PrimaryButton title="Continue" onPress={() => router.push(`/challenge/${current.id}`)} />
        </>
      ) : (
        <>
          <Empty title="No active challenge" hint="Get one made for your gear and your skills." />
          <PrimaryButton title="New challenge" busy={create.isPending} onPress={() => create.mutate({})} />
          {create.isError ? <Notice tone="error" text={errorText(create.error)} /> : null}
        </>
      )}
      <LastUpdated at={active.dataUpdatedAt} />
    </View>
  );
}
