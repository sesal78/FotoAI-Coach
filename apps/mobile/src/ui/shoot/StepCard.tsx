// One step of a shoot plan: when (at the place), what to do, the settings, and Done, Skip or Undo.
// These work with no signal: the change waits in the outbox.

import type { PlanStepDto, SettingsDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { TextLink } from '../form';

/** "18:40": the step's time at the place (the server sends it with the place's offset). */
export const placeTime = (startsAt: string | null) => (startsAt && /T\d{2}:\d{2}/.test(startsAt) ? startsAt.slice(11, 16) : null);

export const shutterText = (seconds: number) => (seconds < 1 ? `1/${Math.round(1 / seconds)} s` : `${seconds} s`);

/** "M · f/2.8 · 1/4 s · ISO 400 · 50 mm" */
export function settingsText(s: SettingsDto): string {
  return [
    s.mode,
    s.aperture !== undefined ? `f/${s.aperture}` : null,
    s.shutterSeconds !== undefined ? shutterText(s.shutterSeconds) : null,
    s.iso !== undefined ? `ISO ${s.iso}` : null,
    s.focalMm !== undefined ? `${s.focalMm} mm` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function StepCard({
  step,
  onChange,
  onLogFrame,
}: {
  step: PlanStepDto;
  onChange: (status: PlanStepDto['status']) => void;
  onLogFrame?: () => void;
}) {
  const time = placeTime(step.startsAt);
  const label = `${step.position}. ${step.title}`;
  return (
    <View testID="step-card" accessibilityLabel={label} className={`gap-2 rounded-lg p-4 ${step.status === 'todo' ? 'bg-surface' : 'bg-surface-alt'}`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-semibold text-text">{label}</Text>
        {time ? <Text className="font-semibold text-accent">{time}</Text> : null}
      </View>
      <Text className="text-text">{step.instruction}</Text>
      {step.tip ? <Text className="text-text-muted">{`Tip: ${step.tip}`}</Text> : null}
      <Text className="text-text">{settingsText(step.settings)}</Text>
      {step.status === 'todo' ? (
        <View className="flex-row gap-6">
          <TextLink title="Done" onPress={() => onChange('done')} />
          <TextLink title="Skip" onPress={() => onChange('skipped')} />
        </View>
      ) : (
        <View className="flex-row items-center gap-6">
          <Text className={step.status === 'done' ? 'font-semibold text-success' : 'font-semibold text-text-muted'}>{step.status === 'done' ? 'Done ✓' : 'Skipped'}</Text>
          <TextLink title="Undo" onPress={() => onChange('todo')} />
        </View>
      )}
      {onLogFrame ? <TextLink title="Log a frame" onPress={onLogFrame} /> : null}
    </View>
  );
}
