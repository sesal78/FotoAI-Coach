// The moving picture at the top of the conditions card: sun, moon and stars, clouds, rain, snow,
// thunder, fog and wind. The left part stays calm: the temperature and weather words sit there.
// Drawn with react-native-svg and moved with React Native's Animated on the native thread
// (transform and opacity only). When the phone asks for less motion, it stays still. The picture
// fills the box it is given: positions are laid out for SCENE_HEIGHT and scale with the real height.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { Scene } from './scene';
import { useReducedMotion } from './useReducedMotion';

/** The smallest height, and the height the positions below are laid out for. */
export const SCENE_HEIGHT = 92;

/** Things in the picture grow with it, up to this many times their size. */
const MAX_GROW = 1.5;

const CLOUD = 'M22 58a20 20 0 0 1-2-40 26 26 0 0 1 49-6 18 18 0 0 1 25 17 15 15 0 0 1-4 29z';
const MOON = 'M20 6A14 14 0 1 0 20 34A10 14 0 1 1 20 6Z';
const fill = StyleSheet.absoluteFill;

/** A value that runs 0 to 1 again and again (or 0 to 1 to 0 with `bounce`), while `run` is true. */
function useLoop(ms: number, run: boolean, bounce = false): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.setValue(0);
    if (!run) return;
    const step = (toValue: number) =>
      Animated.timing(value, { toValue, duration: ms, easing: bounce ? Easing.inOut(Easing.sin) : Easing.linear, useNativeDriver: true });
    const loop = Animated.loop(bounce ? Animated.sequence([step(1), step(0)]) : step(1));
    loop.start();
    return () => loop.stop();
  }, [value, ms, run, bounce]);
  return value;
}

const grown = (k: number) => Math.min(k, MAX_GROW);
const between = (v: Animated.Value, from: number, to: number) => v.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

function Sun({ run, k }: { run: boolean; k: number }) {
  const spin = useLoop(18_000, run);
  const pulse = useLoop(1_500, run, true);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ position: 'absolute', right: 12, top: 6 * k, width: 78 * grown(k), height: 78 * grown(k) }}>
      <Animated.View style={[fill, { opacity: between(pulse, 0.55, 0.25), transform: [{ scale: between(pulse, 1, 1.18) }] }]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={30} fill="#ffb347" />
        </Svg>
      </Animated.View>
      <Animated.View style={[fill, { transform: [{ rotate }] }]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G stroke="#f59e2b" strokeWidth={4} strokeLinecap="round">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <Line key={deg} x1={50} y1={6} x2={50} y2={16} transform={`rotate(${deg} 50 50)`} />
            ))}
          </G>
        </Svg>
      </Animated.View>
      <Svg style={fill} width="100%" height="100%" viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={22} fill="#ff9f1c" />
      </Svg>
    </View>
  );
}

const STARS: Array<[number, number]> = [[46, 18], [52, 62], [58, 30], [64, 78], [70, 12], [76, 50], [82, 82], [90, 66], [94, 24], [86, 40]];

function MoonAndStars({ run, k }: { run: boolean; k: number }) {
  const twinkle = useLoop(1_200, run, true);
  const groups = [between(twinkle, 0.3, 1), between(twinkle, 1, 0.3)];
  return (
    <>
      {groups.map((opacity, g) => (
        <Animated.View key={g} style={[fill, { opacity }]}>
          {STARS.filter((_, i) => i % 2 === g).map(([left, top]) => (
            <View key={`${left}-${top}`} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: 3, height: 3, borderRadius: 2, backgroundColor: '#ffffff' }} />
          ))}
        </Animated.View>
      ))}
      <Svg style={{ position: 'absolute', right: 26, top: 14 * k }} width={40 * grown(k)} height={40 * grown(k)} viewBox="0 0 40 40">
        <Path d={MOON} fill="#f4ecd2" />
      </Svg>
    </>
  );
}

function Cloud({ left, top, width, color, ms, run }: { left: DimensionValue; top: number; width: number; color: string; ms: number; run: boolean }) {
  const drift = useLoop(ms, run, true);
  return (
    <Animated.View style={{ position: 'absolute', left, top, width, height: width * 0.6, transform: [{ translateX: between(drift, -14, 14) }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 60">
        <Path d={CLOUD} fill={color} />
      </Svg>
    </Animated.View>
  );
}

type Fall = 'rain' | 'drizzle' | 'snow';
const FALL: Record<Fall, { layers: number[]; per: number }> = {
  rain: { layers: [700, 900, 1_100], per: 6 },
  drizzle: { layers: [1_500, 1_900], per: 4 },
  snow: { layers: [5_000, 6_500, 8_000], per: 5 },
};

/** One layer of drops or flakes. The layer is two pictures high and slides down one picture, so
 * the loop has no seam. */
function FallLayer({ type, ms, index, run, night, h }: { type: Fall; ms: number; index: number; run: boolean; night: boolean; h: number }) {
  const t = useLoop(ms, run);
  const sway = useLoop(2_400, run && type === 'snow', true);
  const items = Array.from({ length: FALL[type].per }, (_, i) => {
    const n = index * FALL[type].per + i;
    return { left: `${((n * 37) % 50) + 46}%` as DimensionValue, top: (n * 53) % h };
  });
  const dot =
    type === 'snow'
      ? { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' }
      : { width: 2, height: type === 'rain' ? 12 : 6, borderRadius: 1, backgroundColor: night ? 'rgba(200,215,235,0.6)' : 'rgba(40,70,110,0.55)' };
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: -h,
        height: h * 2,
        transform: [{ translateY: between(t, 0, h) }, { translateX: between(sway, -6, 6) }],
      }}
    >
      {items.flatMap(({ left, top }) => [top, top + h].map((y) => <View key={`${left}-${y}`} style={[dot, { position: 'absolute', left, top: y }]} />))}
    </Animated.View>
  );
}

function Falling({ type, run, night, h }: { type: Fall; run: boolean; night: boolean; h: number }) {
  return (
    <>
      {FALL[type].layers.map((ms, i) => (
        <FallLayer key={ms} type={type} ms={ms} index={i} run={run} night={night} h={h} />
      ))}
    </>
  );
}

function Thunder({ run, k }: { run: boolean; k: number }) {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    flash.setValue(0);
    if (!run) return;
    const to = (toValue: number, duration: number) => Animated.timing(flash, { toValue, duration, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([Animated.delay(2_600), to(0.75, 80), to(0.1, 80), to(0.6, 80), to(0, 240)]));
    loop.start();
    return () => loop.stop();
  }, [flash, run]);
  return (
    <>
      <Animated.View style={{ position: 'absolute', left: '68%', top: 44 * k, opacity: flash.interpolate({ inputRange: [0, 0.3, 0.75], outputRange: [0, 1, 1] }) }}>
        <Svg width={30} height={40} viewBox="0 0 30 40">
          <Path d="M18 0L6 20h9L9 40 27 14h-9l6-14z" fill="#ffd54a" />
        </Svg>
      </Animated.View>
      <Animated.View style={[fill, { backgroundColor: '#ffffff', opacity: flash }]} />
    </>
  );
}

function Fog({ run, k }: { run: boolean; k: number }) {
  const bands: Array<[number, number]> = [[10, 8_000], [36, 11_000], [62, 9_000]];
  return (
    <>
      {bands.map(([top, ms]) => (
        <FogBand key={top} top={top * k} ms={ms} run={run} />
      ))}
    </>
  );
}

function FogBand({ top, ms, run }: { top: number; ms: number; run: boolean }) {
  const drift = useLoop(ms, run, true);
  return (
    <Animated.View style={{ position: 'absolute', left: '-30%', width: '160%', top, height: 26, transform: [{ translateX: between(drift, -30, 30) }] }}>
      <View style={{ ...fill, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 7, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.45)' }} />
    </Animated.View>
  );
}

function Wind({ run, width, night }: { run: boolean; width: number; night: boolean }) {
  const lines: Array<[DimensionValue, number]> = [['22%', 2_200], ['50%', 2_600], ['78%', 3_000]];
  return (
    <>
      {lines.map(([top, ms]) => (
        <WindLine key={ms} top={top} ms={ms} run={run} width={width} color={night ? 'rgba(255,255,255,0.7)' : 'rgba(70,120,140,0.6)'} />
      ))}
    </>
  );
}

function WindLine({ top, ms, run, width, color }: { top: DimensionValue; ms: number; run: boolean; width: number; color: string }) {
  const t = useLoop(ms, run);
  return (
    <Animated.View
      style={{ position: 'absolute', left: 0, top, width: 56, height: 3, borderRadius: 2, backgroundColor: color, transform: [{ translateX: between(t, -70, width + 10) }] }}
    />
  );
}

export function WeatherScene({ scene }: { scene: Scene }) {
  const run = !useReducedMotion();
  const [size, setSize] = useState({ width: 320, height: SCENE_HEIGHT });
  const { width } = size;
  const h = Math.max(size.height, SCENE_HEIGHT);
  const k = h / SCENE_HEIGHT;
  const { kind, night } = scene;
  const cloud = night ? '#5b6477' : kind === 'thunder' ? '#5d6675' : '#ffffff';
  const sky = kind === 'clear' || kind === 'partly_cloudy' ? night ? <MoonAndStars run={run} k={k} /> : <Sun run={run} k={k} /> : null;
  const fall: Fall | null = kind === 'rain' || kind === 'thunder' ? 'rain' : kind === 'drizzle' ? 'drizzle' : kind === 'snow' ? 'snow' : null;
  const clouds =
    kind === 'partly_cloudy' ? [{ left: '48%', top: 40, width: 90, ms: 9_000 }]
    : kind === 'cloudy' ? [{ left: '66%', top: 2, width: 100, ms: 17_000 }, { left: '48%', top: 30, width: 120, ms: 9_000 }]
    : kind === 'rain' || kind === 'drizzle' || kind === 'thunder' ? [{ left: '52%', top: -6, width: 140, ms: 13_000 }]
    : [];

  return (
    <View
      testID={`weather-scene-${kind}${night ? '-night' : ''}${scene.windy ? '-windy' : ''}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      style={{ flex: 1, minHeight: SCENE_HEIGHT, overflow: 'hidden' }}
    >
      <Svg style={fill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={scene.sky[0]} />
            <Stop offset="1" stopColor={scene.sky[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sky)" />
      </Svg>
      {sky}
      {fall ? <Falling type={fall} run={run} night={night} h={h} /> : null}
      {clouds.map((c) => (
        <Cloud key={c.ms} left={c.left as DimensionValue} top={c.top * k} width={c.width * grown(k)} color={cloud} ms={c.ms} run={run} />
      ))}
      {kind === 'thunder' ? <Thunder run={run} k={k} /> : null}
      {kind === 'fog' ? <Fog run={run} k={k} /> : null}
      {scene.windy ? <Wind run={run} width={width} night={night} /> : null}
    </View>
  );
}
