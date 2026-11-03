import { screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { LIGHT, WEATHER } from '../../../../test/fixtures';
import { renderScreen } from '../../../../test/harness';
import { ConditionsCard } from '../ConditionsCard';
import { sceneOf, WINDY_KPH } from '../scene';

// The pictures are hidden from screen readers (the words say the same), so queries include hidden parts.
const hidden = { includeHiddenElements: true } as const;
const at = (local: string) => new Date(`2026-10-20T${local}:00+11:00`);
const weather = (over: Partial<typeof WEATHER.current>) => ({ ...WEATHER, current: { ...WEATHER.current, ...over } });
const card = (props: { condition?: (typeof WEATHER.current)['condition']; windKph?: number; now?: string; none?: boolean } = {}) => (
  <ConditionsCard
    light={LIGHT}
    weather={props.none ? null : weather({ condition: props.condition ?? 'partly_cloudy', windKph: props.windKph ?? 12 })}
    units="metric"
    now={at(props.now ?? '13:05')}
    place="Fitzroy"
  />
);

// One render per test: a second render in the same test (after unmount) leaves the next tests'
// screen in a bad state.

test('each weather kind has its own picture; wind lines from 30 km/h; unknown weather has none', () => {
  expect(sceneOf('rain', 5, false)).toMatchObject({ kind: 'rain', night: false, windy: false });
  expect(sceneOf('clear', WINDY_KPH, true)).toMatchObject({ kind: 'clear', night: true, windy: true });
  expect(sceneOf('clear', 10, true)!.sky).not.toEqual(sceneOf('clear', 10, false)!.sky);
  expect(sceneOf('unknown', 50, false)).toBeNull();
});

test('the card shows the picture for the weather now, with the place, temperature and words on it', async () => {
  await renderScreen(card({ condition: 'thunder', windKph: 40 }));
  expect(screen.getByTestId('weather-scene-thunder-windy', hidden)).toBeTruthy();
  expect(screen.getByText('Fitzroy')).toBeTruthy();
  expect(screen.getByText('17°C')).toBeTruthy();
  expect(screen.getByText('Thunder')).toBeTruthy();
  expect(screen.getByText('40% cloud · wind 40 km/h')).toBeTruthy();
  expect(screen.getByText(WEATHER.attribution)).toBeTruthy();
});

test('after sunset the clear sky has the moon', async () => {
  await renderScreen(card({ condition: 'clear', now: '21:00' }));
  expect(screen.getByTestId('weather-scene-clear-night', hidden)).toBeTruthy();
});

test('unknown weather shows only the words', async () => {
  await renderScreen(card({ condition: 'unknown' }));
  expect(screen.queryByTestId(/weather-scene/, hidden)).toBeNull();
  expect(screen.getByText('Unknown')).toBeTruthy();
});

test('with no weather the card says so and still shows the light', async () => {
  await renderScreen(card({ none: true }));
  expect(screen.getByText('Weather unavailable')).toBeTruthy();
  expect(screen.getByText('Golden hour in 6 h')).toBeTruthy();
});

test('the picture moves', async () => {
  const loop = jest.spyOn(Animated, 'loop');
  try {
    await renderScreen(card({ condition: 'rain' }));
    await waitFor(() => expect(loop).toHaveBeenCalled());
  } finally {
    loop.mockRestore();
  }
});

test('the picture stays still when the phone asks for less motion', async () => {
  // React Native's Jest setup makes this a mock that answers false; restoring it would empty it.
  const reduce = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
  reduce.mockResolvedValue(true);
  const loop = jest.spyOn(Animated, 'loop');
  try {
    await renderScreen(card({ condition: 'rain' }));
    await screen.findByTestId('weather-scene-rain', hidden);
    await new Promise((r) => setTimeout(r, 0)); // the phone's answer arrives
    expect(loop).not.toHaveBeenCalled();
  } finally {
    loop.mockRestore();
    reduce.mockResolvedValue(false);
  }
});

test('the light times are a small table, with sunrise and sunset, and the next window marked', async () => {
  await renderScreen(card());
  expect(screen.getByText('Golden hour in 6 h')).toBeTruthy();
  expect(screen.getByText('19:05 to 19:58')).toBeTruthy();
  expect(screen.getByText('05:50–06:10')).toBeTruthy();
  expect(screen.getByText('Rise 06:28')).toBeTruthy();
  expect(screen.getByText('Set 19:41')).toBeTruthy();
  expect(screen.getByTestId('light-cell-marked')).toHaveTextContent('19:05–19:58');
  expect(screen.getByLabelText('Evening: blue hour 19:58 to 20:20, golden hour 19:05 to 19:58, sunset 19:41')).toBeTruthy();
  expect(screen.getByTestId('sun-now', hidden)).toBeTruthy();
});

test('during blue morning its time is marked', async () => {
  await renderScreen(card({ now: '06:00' }));
  expect(screen.getByTestId('light-cell-marked')).toHaveTextContent('05:50–06:10');
});

test('before blue morning the sun is off the path', async () => {
  await renderScreen(card({ now: '05:00' }));
  expect(screen.getByTestId('sun-path', hidden)).toBeTruthy();
  expect(screen.queryByTestId('sun-now', hidden)).toBeNull();
});
