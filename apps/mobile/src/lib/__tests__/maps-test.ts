import Constants from 'expo-constants';

import { mapsConfigured } from '../maps';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));
const setConfig = (expoConfig: unknown) => Object.assign(Constants, { expoConfig });

test('the map is on when the build says so, as the APK carries no android.config at run time', () => {
  // What a real build ships: the key is in the Android manifest, not in the run-time config.
  setConfig({ android: { package: 'com.topues.fotoai' }, extra: { mapsEnabled: true } });
  expect(mapsConfigured()).toBe(true);
});

test('the map is off without the flag', () => {
  setConfig({ android: { package: 'com.topues.fotoai' }, extra: { mapsEnabled: false } });
  expect(mapsConfigured()).toBe(false);
  setConfig(null);
  expect(mapsConfigured()).toBe(false);
});
