// New plan: the place handed over from Explore, the day, and the loadout the server will use.
// Making a plan runs the AI on the server, so it needs a signal (saved plans still open offline).

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useLoadout, usePlace, useSpots } from '../../data/hooks';
import { useMakePlan } from '../../data/shoot';
import { localDay } from '../LastUpdated';
import { Field, Notice, PrimaryButton, TextLink } from '../form';
import { errorText, isOffline } from '../states';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// The server's answers that the loadout screen fixes.
const LOADOUT_PROBLEMS = ['Set your loadout first', 'Load a film first'];

function GooglePlaceName({ placeId }: { placeId: string }) {
  const name = usePlace(placeId).data?.place.name;
  return name ? <Text className="text-lg font-semibold text-text">{`Planning: ${name}`}</Text> : null;
}

function SpotName({ spotId }: { spotId: string }) {
  const name = useSpots().data?.spots.find((s) => s.id === spotId)?.name;
  return name ? <Text className="text-lg font-semibold text-text">{`Planning: ${name}`}</Text> : null;
}

function LoadoutLine() {
  const loadout = useLoadout().data?.loadout;
  if (!loadout) return <Text className="text-text-muted">No loadout set yet.</Text>;
  const line = [loadout.body.name, loadout.lens.model, loadout.film?.stock].filter(Boolean).join(' · ');
  return <Text className="text-text">{line}</Text>;
}

export function NewPlan({ placeId, spotId }: { placeId?: string; spotId?: string }) {
  const make = useMakePlan();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [other, setOther] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    const typed = other.trim();
    if (typed && !DATE.test(typed)) return setProblem('Write the date as YYYY-MM-DD, for example 2026-11-02');
    setProblem(null);
    const date = typed || (day === 'tomorrow' ? localDay(Date.now() + DAY_MS) : undefined);
    const where = placeId ? { placeId } : { spotId: spotId! };
    make.mutate({ ...where, ...(date ? { date } : {}) }, { onSuccess: ({ plan }) => router.push(`/plan/${plan.id}`) });
  };

  const message = make.error ? (isOffline(make.error) ? 'Making a plan needs a signal. Your saved plans still open.' : errorText(make.error)) : null;

  return (
    <View accessibilityLabel="New plan" className="gap-3 rounded-lg border border-primary bg-surface p-4">
      {placeId ? <GooglePlaceName placeId={placeId} /> : spotId ? <SpotName spotId={spotId} /> : null}
      <View className="flex-row gap-2">
        {(['today', 'tomorrow'] as const).map((d) => {
          const on = day === d && !other.trim();
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setDay(d);
                setOther('');
              }}
              className={`min-h-11 justify-center rounded-pill border px-4 ${on ? 'border-primary bg-primary' : 'border-border bg-surface-alt'}`}
            >
              <Text className={on ? 'font-semibold text-on-primary' : 'text-text'}>{d === 'today' ? 'Today' : 'Tomorrow'}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field label="Or another date" value={other} onChangeText={setOther} placeholder="YYYY-MM-DD" maxLength={10} keyboardType="numbers-and-punctuation" />
      <View className="gap-1">
        <Text className="text-sm font-semibold text-text-muted">Camera</Text>
        <LoadoutLine />
        <TextLink title="Change loadout" onPress={() => router.push('/me/loadout')} />
      </View>
      {problem ? <Notice tone="error" text={problem} /> : null}
      {message ? <Notice tone="error" text={message} /> : null}
      {message && LOADOUT_PROBLEMS.includes(message) ? <TextLink title="Open the loadout" onPress={() => router.push('/me/loadout')} /> : null}
      <PrimaryButton title="Make the plan" busy={make.isPending} onPress={submit} />
    </View>
  );
}
