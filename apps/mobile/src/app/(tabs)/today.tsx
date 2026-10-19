import { ActiveChallengeResponse } from '@fotoai/contracts';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { getApi } from '../../data/client';
import { Screen } from '../../ui/form';
import { Empty, ErrorState, Loading } from '../../ui/states';

export default function Today() {
  const active = useQuery({
    queryKey: ['challenges', 'active'],
    queryFn: () => getApi().request('/api/v2/challenges/active', { schema: ActiveChallengeResponse }),
  });

  return (
    <Screen title="Today">
      {active.isPending ? <Loading /> : null}
      {active.isError ? <ErrorState error={active.error} onRetry={() => void active.refetch()} /> : null}
      {active.data && !active.data.challenge ? <Empty title="No active challenge" hint="New challenges and light times arrive in the next update." /> : null}
      {active.data?.challenge ? (
        <View className="gap-2 rounded-lg bg-surface p-4">
          <Text className="text-sm font-semibold uppercase text-text-muted">Active challenge</Text>
          <Text className="text-lg text-text">{active.data.challenge.challengeText}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
