// The countdown to the next good light, the day's sun path, and the day's light times in the
// place's clock, with the window on now (or next) marked.

import type { LightTimesDto } from '@fotoai/contracts';
import { Text, View } from 'react-native';

import { clockOf, dayArc, nextGoodLight, untilText, type GoodLight, type LightKind } from '../../lib/light';
import { LIGHT_COLOURS, SunPath } from './SunPath';

const NAME = { golden: 'Golden hour', blue: 'Blue hour' } as const;

// Fixed colours, not theme colours: the pill has the colour of the light it counts down to.
const PILL: Record<LightKind, { bg: string; text: string }> = {
  golden: { bg: '#f7cf94', text: '#2b1606' },
  blue: { bg: '#c9d5ee', text: '#13203d' },
};

function Countdown({ light, next, now }: { light: LightTimesDto; next: GoodLight | null; now: Date }) {
  if (light.sunAlwaysUp) return <Text className="text-lg text-text">The sun does not set today.</Text>;
  if (light.sunAlwaysDown) return <Text className="text-lg text-text">The sun does not rise today.</Text>;
  if (!next) return <Text className="text-lg text-text">No more good light today. Check back tomorrow.</Text>;
  return (
    <View className="rounded-md px-3 py-2" style={{ backgroundColor: PILL[next.kind].bg }}>
      <Text className="text-2xl font-bold" style={{ color: PILL[next.kind].text }}>
        {next.phase === 'now' ? `${NAME[next.kind]} now · ends in ${untilText(next.end, now)}` : `${NAME[next.kind]} in ${untilText(next.start, now)}`}
      </Text>
    </View>
  );
}

function Row({ label, value, mark, on = false }: { label: string; value: string; mark: LightKind | 'sun'; on?: boolean }) {
  return (
    <View testID={on ? 'light-row-marked' : undefined} className={`flex-row items-center gap-2 py-1 ${on ? '-mx-2 rounded-md bg-surface-alt px-2' : ''}`}>
      {mark === 'sun' ? (
        <View className="mx-px h-2 w-2 rounded-full bg-text" />
      ) : (
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: LIGHT_COLOURS[mark] }} />
      )}
      <Text className={on ? 'font-semibold text-text' : 'text-text-muted'}>{label}</Text>
      <Text className={`ml-auto text-text ${on ? 'font-semibold' : ''}`}>{value}</Text>
    </View>
  );
}

const span = (w: { start: string; end: string } | null) => (w ? `${clockOf(w.start)}–${clockOf(w.end)}` : '–');

export function LightCard({ light, now, place }: { light: LightTimesDto; now: Date; place: string }) {
  const next = nextGoodLight(light, now);
  const arc = dayArc(light, now);
  const marked = (w: { start: string } | null) => w !== null && next !== null && w.start === next.start;
  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      <Text className="text-sm font-semibold uppercase text-text-muted">{`Light at ${place}`}</Text>
      <Countdown light={light} next={next} now={now} />
      {arc ? <SunPath arc={arc} /> : null}
      <View className="gap-1">
        <Row label="Blue morning" value={span(light.blueMorning)} mark="blue" on={marked(light.blueMorning)} />
        <Row label="Sunrise" value={light.sunrise ? clockOf(light.sunrise) : '–'} mark="sun" />
        <Row label="Golden morning" value={span(light.goldenMorning)} mark="golden" on={marked(light.goldenMorning)} />
        <Row label="Golden evening" value={span(light.goldenEvening)} mark="golden" on={marked(light.goldenEvening)} />
        <Row label="Blue evening" value={span(light.blueEvening)} mark="blue" on={marked(light.blueEvening)} />
        <Row label="Sunset" value={light.sunset ? clockOf(light.sunset) : '–'} mark="sun" />
      </View>
    </View>
  );
}
