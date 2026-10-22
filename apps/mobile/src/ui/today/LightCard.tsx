// The countdown to the next good light, and the day's light times in the place's clock.

import type { LightTimesDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { clockOf, nextGoodLight, untilText } from '../../lib/light';

const NAME = { golden: 'Golden hour', blue: 'Blue hour' } as const;

function Countdown({ light, now }: { light: LightTimesDto; now: Date }) {
  const next = nextGoodLight(light, now);
  if (light.sunAlwaysUp) return <Text className="text-lg text-text">The sun does not set today.</Text>;
  if (light.sunAlwaysDown) return <Text className="text-lg text-text">The sun does not rise today.</Text>;
  if (!next) return <Text className="text-lg text-text">No more good light today. Check back tomorrow.</Text>;
  return next.phase === 'now' ? (
    <Text className="text-2xl font-bold text-text">{`${NAME[next.kind]} now · ends in ${untilText(next.end, now)}`}</Text>
  ) : (
    <Text className="text-2xl font-bold text-text">{`${NAME[next.kind]} in ${untilText(next.start, now)}`}</Text>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-text-muted">{label}</Text>
      <Text className="text-text">{value}</Text>
    </View>
  );
}

const span = (w: { start: string; end: string } | null) => (w ? `${clockOf(w.start)}–${clockOf(w.end)}` : '–');

export function LightCard({ light, now, place }: { light: LightTimesDto; now: Date; place: string }) {
  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      <Text className="text-sm font-semibold uppercase text-text-muted">{`Light at ${place}`}</Text>
      <Countdown light={light} now={now} />
      <View className="gap-1">
        <Row label="Sunrise" value={light.sunrise ? clockOf(light.sunrise) : '–'} />
        <Row label="Golden morning" value={span(light.goldenMorning)} />
        <Row label="Golden evening" value={span(light.goldenEvening)} />
        <Row label="Blue evening" value={span(light.blueEvening)} />
        <Row label="Sunset" value={light.sunset ? clockOf(light.sunset) : '–'} />
      </View>
    </View>
  );
}
