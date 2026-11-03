// The day's sun path on the light card: an arc from blue morning to blue evening with the blue and
// golden windows coloured, and the sun where it is now (its glow pulses unless the phone asks for
// less motion). A picture of the times listed below it, so screen readers skip it.

import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { clockOf, type DayArc } from '../../lib/light';
import { useTheme } from '../ThemeProvider';
import { useReducedMotion } from './useReducedMotion';

export const LIGHT_COLOURS = { blue: '#5874b3', golden: '#f0a43c' } as const;

const W = 300;
const H = 158;
const R = 130;
const CX = 150;
const CY = 150;
const LENGTH = Math.PI * R;
const ARC = `M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`;

/** The point on the arc a part `f` (0 to 1) of the way along it. */
export function arcPoint(f: number): { x: number; y: number } {
  const a = Math.PI * (1 - f);
  return { x: CX + R * Math.cos(a), y: CY - R * Math.sin(a) };
}

function Glow({ x, y }: { x: number; y: number }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    if (reduced) return;
    const to = (toValue: number) => Animated.timing(pulse, { toValue, duration: 1_200, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([to(1), to(0)]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${(x / W) * 100}%`,
        top: `${(y / H) * 100}%`,
        width: 30,
        height: 30,
        marginLeft: -15,
        marginTop: -15,
        borderRadius: 15,
        backgroundColor: '#ff9f1c',
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.12] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) }],
      }}
    />
  );
}

export function SunPath({ arc }: { arc: DayArc }) {
  const { tokens } = useTheme();
  const sun = arc.sun === null ? null : arcPoint(arc.sun);
  return (
    <View testID="sun-path" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="gap-1">
      <View style={{ width: '100%', aspectRatio: W / H }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          <Path d={ARC} fill="none" stroke={tokens.colors.border} strokeWidth={3} strokeDasharray={[2, 6]} strokeLinecap="round" />
          {arc.windows.map((w) => (
            <Path
              key={`${w.kind}-${w.start}`}
              d={ARC}
              fill="none"
              stroke={LIGHT_COLOURS[w.kind]}
              strokeWidth={9}
              strokeDasharray={[0, w.start * LENGTH, (w.end - w.start) * LENGTH, LENGTH * 2]}
            />
          ))}
          <Line x1={8} y1={CY} x2={W - 8} y2={CY} stroke={tokens.colors.border} strokeWidth={2} />
          {sun ? <Circle testID="sun-now" cx={sun.x} cy={sun.y} r={8} fill="#ff9f1c" stroke="#ffffff" strokeWidth={2} /> : null}
        </Svg>
        {sun ? <Glow x={sun.x} y={sun.y} /> : null}
      </View>
      <View className="flex-row justify-between">
        <Text className="text-xs text-text-muted">{clockOf(arc.from)}</Text>
        <Text className="text-xs text-text-muted">{clockOf(arc.to)}</Text>
      </View>
    </View>
  );
}
