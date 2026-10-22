// One challenge: what to shoot and how, and the status moves the server allows from where it is now.

import type { ChallengeDto } from '@fotoai/contracts';
import { CHALLENGE_MOVES, type ChallengeState } from '@fotoai/core';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useChallenge, usePatchChallenge } from '../../data/hooks';
import { Notice, PrimaryButton, Screen, TextLink } from '../../ui/form';
import { LastUpdated } from '../../ui/LastUpdated';
import { ErrorState, errorText, Loading } from '../../ui/states';

const STATUS: Record<ChallengeDto['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  skipped: 'Skipped',
  completed: 'Completed',
  superseded: 'Replaced',
};

const ACTIONS = [
  ['accepted', 'Accept'],
  ['skipped', 'Skip'],
  ['completed', 'Complete'],
] as const;

function Part({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <View className="gap-1">
      <Text className="font-semibold text-text">{title}</Text>
      <Text className="text-text">{text}</Text>
    </View>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-1">
      <Text className="font-semibold text-text">{title}</Text>
      {items.map((item) => (
        <Text key={item} className="text-text">{`• ${item}`}</Text>
      ))}
    </View>
  );
}

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useChallenge(id);
  const move = usePatchChallenge();

  return (
    <Screen title="Challenge">
      <TextLink title="Back" onPress={() => router.back()} />
      {query.isPending ? <Loading label="Loading the challenge…" /> : null}
      {query.isError && !query.data ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.data ? <Detail c={query.data.challenge} busy={move.isPending} onMove={(status) => move.mutate({ id, status })} /> : null}
      {move.isError ? <Notice tone="error" text={errorText(move.error)} /> : null}
      <LastUpdated at={query.dataUpdatedAt} />
    </Screen>
  );
}

function Detail({ c, busy, onMove }: { c: ChallengeDto; busy: boolean; onMove: (s: 'accepted' | 'skipped' | 'completed') => void }) {
  const allowed = CHALLENGE_MOVES[c.status as ChallengeState] ?? [];
  return (
    <View className="gap-4 rounded-lg bg-surface p-4">
      <Text className="self-start rounded-pill bg-surface-alt px-3 py-1 text-sm font-semibold text-text">{STATUS[c.status]}</Text>
      <Text className="text-xl text-text">{c.challengeText}</Text>
      <Text className="text-text-muted">{[c.category, c.difficulty, c.duration].filter(Boolean).join(' · ')}</Text>
      <Part title="Tips" text={c.tips} />
      <List title="Gear" items={c.recommendedGear} />
      <List title="Shot list" items={c.shotList} />
      <Part title="Story" text={c.narrativeContext} />
      <Part title="Editing" text={c.editingDirection} />
      <Part title="Skill" text={c.masteryArea} />
      {c.technicalLevel ? <Part title="Level" text={`${c.technicalLevel} of 5`} /> : null}
      <Part title="You did it when" text={c.successCriteria} />
      <Part title="What to look for" text={c.whatToLookFor} />
      {ACTIONS.filter(([to]) => allowed.includes(to)).map(([to, label]) => (
        <PrimaryButton key={to} title={label} busy={busy} onPress={() => onMove(to)} />
      ))}
    </View>
  );
}
