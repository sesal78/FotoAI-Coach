// "Best light and angles": an AI explanation that runs only from the tap (it costs an AI call).

import type { PlaceExplanationDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { Notice, PrimaryButton } from '../form';
import { errorText, Loading } from '../states';

interface Asked {
  asked: boolean;
  ask: () => void;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  data?: { explanation: PlaceExplanationDto };
  refetch: () => unknown;
}

export function ExplainCard({ query }: { query: Asked }) {
  const e = query.data?.explanation;
  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      {!query.asked ? <PrimaryButton title="Best light and angles" onPress={query.ask} /> : null}
      {query.isFetching ? <Loading label="Asking the coach…" /> : null}
      {query.isError && !e ? (
        <>
          <Notice tone="error" text={errorText(query.error)} />
          {!query.isFetching ? <PrimaryButton title="Try again" onPress={() => void query.refetch()} /> : null}
        </>
      ) : null}
      {e ? (
        <>
          <Text className="text-sm font-semibold uppercase text-text-muted">Best light</Text>
          <Text className="text-text">{e.bestLight}</Text>
          {e.angles.length ? <Text className="text-sm font-semibold uppercase text-text-muted">Angles</Text> : null}
          {e.angles.map((a) => (
            <Text key={a} className="text-text">{`• ${a}`}</Text>
          ))}
          {e.caution ? <Notice text={e.caution} /> : null}
        </>
      ) : null}
    </View>
  );
}
