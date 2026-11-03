// Weather and light in one card, on Today and on a place: a short moving picture of the weather
// with the temperature on it, the countdown to the next good light beside a small sun path, and the
// day's light times as a small table (blue, golden, sun; morning and evening) with the next one
// marked. On Today the picture grows into the space left, so the screen is full but does not scroll.

import type { LightTimesDto, Units, WeatherDto } from '@fotoai/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { clockOf, dayArc, isNight, nextGoodLight, untilText, type GoodLight, type LightKind } from '../../lib/light';
import { sceneOf } from './scene';
import { LIGHT_COLOURS, SunPath } from './SunPath';
import { SCENE_HEIGHT, WeatherScene } from './WeatherScene';

const CONDITION: Record<WeatherDto['current']['condition'], string> = {
  clear: 'Clear',
  partly_cloudy: 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  thunder: 'Thunder',
  unknown: 'Unknown',
};

export const temperature = (c: number, units: Units) => (units === 'imperial' ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`);
export const windSpeed = (kph: number, units: Units) => (units === 'imperial' ? `${Math.round(kph / 1.609)} mph` : `${Math.round(kph)} km/h`);

const NAME = { golden: 'Golden hour', blue: 'Blue hour' } as const;

// Fixed colours, not theme colours: the box has the colour of the light it counts down to.
const PILL: Record<LightKind, { bg: string; text: string }> = {
  golden: { bg: '#f7cf94', text: '#2b1606' },
  blue: { bg: '#c9d5ee', text: '#13203d' },
};

function WeatherStrip({ weather, units, night, place, grow }: { weather: WeatherDto | null; units: Units; night: boolean; place?: string; grow: boolean }) {
  const c = weather?.current;
  const scene = c ? sceneOf(c.condition, c.windKph, night) : null;
  // Over the picture the words have the picture's ink (light on dark skies); else theme colours.
  const ink = scene ? { color: scene.night || scene.kind === 'thunder' ? '#f6ebdd' : '#2b1d12' } : undefined;
  return (
    <View style={grow ? { minHeight: SCENE_HEIGHT, flexGrow: 1 } : { height: SCENE_HEIGHT }} className={scene ? undefined : 'bg-surface-alt'}>
      {scene ? (
        <View style={StyleSheet.absoluteFill}>
          <WeatherScene scene={scene} />
        </View>
      ) : null}
      <View className="absolute left-4 top-2.5" style={{ maxWidth: '62%' }}>
        {place ? (
          <Text numberOfLines={1} className="text-xs font-semibold uppercase text-text-muted" style={ink}>
            {place}
          </Text>
        ) : null}
        {c ? (
          <>
            <Text className="text-[28px] font-bold leading-8 text-text" style={ink}>
              {temperature(c.temperatureC, units)}
            </Text>
            <Text numberOfLines={1} className="font-semibold text-text" style={ink}>
              {CONDITION[c.condition]}
            </Text>
            <Text numberOfLines={1} className="text-xs text-text-muted" style={ink}>
              {`${c.cloudPct}% cloud · wind ${windSpeed(c.windKph, units)}`}
            </Text>
          </>
        ) : (
          <Text className="mt-2 text-text-muted">Weather unavailable</Text>
        )}
      </View>
    </View>
  );
}

function Countdown({ light, next, now }: { light: LightTimesDto; next: GoodLight | null; now: Date }) {
  if (light.sunAlwaysUp) return <Text className="text-base text-text">The sun does not set today.</Text>;
  if (light.sunAlwaysDown) return <Text className="text-base text-text">The sun does not rise today.</Text>;
  if (!next) return <Text className="text-base text-text">No more good light today. Check back tomorrow.</Text>;
  const { bg, text } = PILL[next.kind];
  return (
    <View className="rounded-md px-3 py-2" style={{ backgroundColor: bg }}>
      <Text numberOfLines={1} adjustsFontSizeToFit className="text-lg font-bold" style={{ color: text }}>
        {next.phase === 'now' ? `${NAME[next.kind]} now · ends in ${untilText(next.end, now)}` : `${NAME[next.kind]} in ${untilText(next.start, now)}`}
      </Text>
      <Text className="text-xs font-semibold" style={{ color: text }}>{`${clockOf(next.start)} to ${clockOf(next.end)}`}</Text>
    </View>
  );
}

type Window = { start: string; end: string } | null;
const span = (w: Window) => (w ? `${clockOf(w.start)}–${clockOf(w.end)}` : '–');
const spoken = (w: Window) => (w ? `${clockOf(w.start)} to ${clockOf(w.end)}` : 'none');

function Head({ label, mark }: { label: string; mark: LightKind | 'sun' }) {
  return (
    <View className="flex-1 flex-row items-center gap-1 px-1">
      {mark === 'sun' ? <View className="h-2 w-2 rounded-full bg-text" /> : <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: LIGHT_COLOURS[mark] }} />}
      <Text className="text-xs font-semibold text-text-muted">{label}</Text>
    </View>
  );
}

function Cell({ text, on = false }: { text: string; on?: boolean }) {
  return (
    <View testID={on ? 'light-cell-marked' : undefined} className={`flex-1 rounded-md px-1 py-0.5 ${on ? 'bg-surface-alt' : ''}`}>
      <Text numberOfLines={1} adjustsFontSizeToFit className={`text-sm text-text ${on ? 'font-bold' : ''}`}>
        {text}
      </Text>
    </View>
  );
}

function TimesRow({ label, blue, golden, sun, sunWord, next }: { label: string; blue: Window; golden: Window; sun: string | null; sunWord: 'Rise' | 'Set'; next: GoodLight | null }) {
  const marked = (w: Window) => w !== null && next !== null && w.start === next.start;
  const sunText = sun ? `${sunWord} ${clockOf(sun)}` : '–';
  return (
    <View
      accessible
      accessibilityLabel={`${label}: blue hour ${spoken(blue)}, golden hour ${spoken(golden)}, ${sunWord === 'Rise' ? 'sunrise' : 'sunset'} ${sun ? clockOf(sun) : 'none'}`}
      className="flex-row items-center"
    >
      <Text className="w-16 text-sm font-semibold text-text-muted">{label}</Text>
      <Cell text={span(blue)} on={marked(blue)} />
      <Cell text={span(golden)} on={marked(golden)} />
      <Cell text={sunText} />
    </View>
  );
}

/** `grow`: the weather picture takes the space left on the screen (Today), never less than SCENE_HEIGHT. */
export function ConditionsCard({
  light,
  weather,
  units,
  now,
  place,
  grow = false,
}: {
  light: LightTimesDto;
  weather: WeatherDto | null;
  units: Units;
  now: Date;
  place?: string;
  grow?: boolean;
}) {
  const next = nextGoodLight(light, now);
  const arc = dayArc(light, now);
  return (
    <View className={`overflow-hidden rounded-lg bg-surface${grow ? ' grow' : ''}`}>
      <WeatherStrip weather={weather} units={units} night={isNight(light, now)} place={place} grow={grow} />
      <View className="gap-2 px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Countdown light={light} next={next} now={now} />
          </View>
          {arc ? <SunPath arc={arc} /> : null}
        </View>
        <View className="gap-0.5">
          <View className="flex-row" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View className="w-16" />
            <Head label="Blue" mark="blue" />
            <Head label="Golden" mark="golden" />
            <Head label="Sun" mark="sun" />
          </View>
          <TimesRow label="Morning" blue={light.blueMorning} golden={light.goldenMorning} sun={light.sunrise} sunWord="Rise" next={next} />
          <TimesRow label="Evening" blue={light.blueEvening} golden={light.goldenEvening} sun={light.sunset} sunWord="Set" next={next} />
        </View>
        {weather ? <Text className="text-xs text-text-muted">{weather.attribution}</Text> : null}
      </View>
    </View>
  );
}
