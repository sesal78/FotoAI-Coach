import { screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { LIGHT, WEATHER } from '../../../../test/fixtures';
import { renderScreen } from '../../../../test/harness';
import { LightCard } from '../LightCard';
import { sceneOf, WINDY_KPH } from '../scene';
import { WeatherCard } from '../WeatherCard';

// The pictures are hidden from screen readers (the words say the same), so queries include hidden parts.
const hidden = { includeHiddenElements: true } as const;
const at = (local: string) => new Date(`2026-10-20T${local}:00+11:00`);
const weather = (over: Partial<typeof WEATHER.current>) => ({ ...WEATHER, current: { ...WEATHER.current, ...over } });


test('each weather kind has its own picture; wind lines from 30 km/h; unknown weather has none', () => {
  expect(sceneOf('rain', 5, false)).toMatchObject({ kind: 'rain', night: false, windy: false });
  expect(sceneOf('clear', WINDY_KPH, true)).toMatchObject({ kind: 'clear', night: true, windy: true });
  expect(sceneOf('clear', 10, true)!.sky).not.toEqual(sceneOf('clear', 10, false)!.sky);
  expect(sceneOf('unknown', 50, false)).toBeNull();
});

test('the weather card shows the picture for the weather now, and still the words', async () => {
  await renderScreen(<WeatherCard weather={weather({ condition: 'thunder', windKph: 40 })} units="metric" />);
  expect(screen.getByTestId('weather-scene-thunder-windy', hidden)).toBeTruthy();
  expect(screen.getByText('Thunder, 17°C')).toBeTruthy();
});

// One render per test: a second render in the same test (after unmount) leaves the next tests'
// screen in a bad state.
test('at night the clear sky has the moon', async () => {
  await renderScreen(<WeatherCard weather={weather({ condition: 'clear' })} units="metric" night />);
  expect(screen.getByTestId('weather-scene-clear-night', hidden)).toBeTruthy();
});

test('unknown weather shows only the words', async () => {
  await renderScreen(<WeatherCard weather={weather({ condition: 'unknown' })} units="metric" />);
  expect(screen.queryByTestId(/weather-scene/, hidden)).toBeNull();
  expect(screen.getByText('Unknown, 17°C')).toBeTruthy();
});

test('the picture moves', async () => {
  const loop = jest.spyOn(Animated, 'loop');
  try {
    await renderScreen(<WeatherCard weather={weather({ condition: 'rain' })} units="metric" />);
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
    await renderScreen(<WeatherCard weather={weather({ condition: 'rain' })} units="metric" />);
    await screen.findByTestId('weather-scene-rain', hidden);
    await new Promise((r) => setTimeout(r, 0)); // the phone's answer arrives
    expect(loop).not.toHaveBeenCalled();
  } finally {
    loop.mockRestore();
    reduce.mockResolvedValue(false);
  }
});

test('the light card marks the next window and puts the sun on its path', async () => {
  await renderScreen(<LightCard light={LIGHT} now={at('13:05')} place="Fitzroy" />);
  expect(screen.getByText('Golden hour in 6 h')).toBeTruthy();
  expect(screen.getByTestId('light-row-marked', hidden)).toHaveTextContent(/Golden evening/);
  expect(screen.getByTestId('sun-path', hidden)).toBeTruthy();
  expect(screen.getByTestId('sun-now', hidden)).toBeTruthy();
});

test('during blue morning that row is marked', async () => {
  await renderScreen(<LightCard light={LIGHT} now={at('06:00')} place="Fitzroy" />);
  expect(screen.getByTestId('light-row-marked', hidden)).toHaveTextContent(/Blue morning/);
});

test('before blue morning the sun is off the path', async () => {
  await renderScreen(<LightCard light={LIGHT} now={at('05:00')} place="Fitzroy" />);
  expect(screen.getByTestId('sun-path', hidden)).toBeTruthy();
  expect(screen.queryByTestId('sun-now', hidden)).toBeNull();
});
