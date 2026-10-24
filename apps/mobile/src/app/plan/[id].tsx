// One shoot plan: where, when and with what, then its steps in order. Done, Skip, Undo and the
// plan's own Done and Archive work with no signal (through the outbox). With a film roll loaded,
// "Log a frame" on a step opens the roll with that step's settings.

import type { PlanStepDto } from '@fotoai/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { usePlan, usePlanStatus, useRolls, useStepChange } from '../../data/shoot';
import { Notice, Screen, TextLink } from '../../ui/form';
import { StepCard } from '../../ui/shoot/StepCard';
import { ErrorState, Loading } from '../../ui/states';

function frameLink(rollId: string, step: PlanStepDto): string {
  const s = step.settings;
  const params = [
    ['stepId', step.id],
    ['mode', s.mode],
    ['aperture', s.aperture],
    ['shutterSeconds', s.shutterSeconds],
  ].filter(([, v]) => v !== undefined);
  return `/roll/${rollId}?${params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = usePlan(id);
  const changeStep = useStepChange(id);
  const setStatus = usePlanStatus(id);
  const loaded = useRolls().rolls.find((r) => r.status === 'loaded');
  const plan = query.plan;
  const [problem, setProblem] = useState<string | null>(null);
  // A change that cannot even be put in the outbox (signed out, storage full) says why.
  const save = (write: Promise<unknown>) => {
    setProblem(null);
    write.catch((err: unknown) => setProblem(err instanceof Error ? err.message : 'This change could not be saved.'));
  };

  if (!plan) {
    return (
      <Screen title="Plan">
        <TextLink title="Back" onPress={() => router.back()} />
        {query.isPending ? <Loading label="Loading the plan…" /> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      </Screen>
    );
  }

  const where = plan.placeName ?? (plan.placeUnavailable ? 'No longer on Google Maps' : 'Saved on this phone');
  const loadout = [plan.loadout.body, plan.loadout.lens, plan.loadout.film].filter(Boolean).join(' · ');

  return (
    <Screen title={plan.title}>
      <TextLink title="Back" onPress={() => router.back()} />
      <View className="gap-1">
        <Text className="font-semibold text-text">{where}</Text>
        <Text className="text-text-muted">{plan.date}</Text>
        <Text className="text-text">{loadout}</Text>
      </View>
      <Text className="text-text">{plan.summary}</Text>
      {plan.notes.map((note) => (
        <Text key={note} className="text-text-muted">{`• ${note}`}</Text>
      ))}
      {plan.steps.map((step) => (
        <StepCard
          key={step.id}
          step={step}
          onChange={(status) => save(changeStep(step.id, status))}
          {...(loaded ? { onLogFrame: () => router.push(frameLink(loaded.id, step)) } : {})}
        />
      ))}
      {problem ? <Notice tone="error" text={problem} /> : null}
      {plan.status === 'active' ? (
        <View className="flex-row gap-6">
          <TextLink title="Mark plan done" onPress={() => save(setStatus('done'))} />
          <TextLink title="Archive" onPress={() => save(setStatus('archived'))} />
        </View>
      ) : (
        <Text className="text-text-muted">{plan.status === 'done' ? 'This plan is done.' : 'This plan is archived.'}</Text>
      )}
    </Screen>
  );
}
