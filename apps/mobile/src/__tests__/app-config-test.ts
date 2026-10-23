import config from '../../app.config';

test('the Android app id, scheme and reset App Link are set', () => {
  expect(config.android?.package).toBe('com.topues.fotoai');
  expect(config.scheme).toBe('fotoai');
  expect(config.android?.intentFilters).toEqual([
    expect.objectContaining({ autoVerify: true, data: [{ scheme: 'https', host: 'myfoto.topues.com', pathPrefix: '/reset-password' }] }),
  ]);
});

test('the config carries no secret (the APK is readable)', () => {
  expect(JSON.stringify(config)).not.toMatch(/sk-|service_role|SERVICE_ROLE|AIza|secret/i);
});

test('the app asks for foreground location only: no background location, and the message says why', () => {
  const plugin = (config.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-location') as [string, Record<string, unknown>] | undefined;
  expect(plugin).toBeDefined();
  const opts = plugin![1];
  expect(String(opts.locationWhenInUsePermission)).toMatch(/light|weather|home/i);
  expect(opts.isAndroidBackgroundLocationEnabled ?? false).toBe(false);
  expect(opts.locationAlwaysAndWhenInUsePermission).toBeUndefined();
  expect(JSON.stringify(config.android?.permissions ?? [])).not.toMatch(/BACKGROUND_LOCATION/);
});

test('the app never asks for precise location and keeps its data out of Android backups', () => {
  expect(config.android?.blockedPermissions).toEqual(expect.arrayContaining(['android.permission.ACCESS_FINE_LOCATION']));
  expect(config.android?.allowBackup).toBe(false);
});

test('with GOOGLE_MAPS_ANDROID_API_KEY set, the Android Maps key is in the config, and only there', () => {
  const before = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  process.env.GOOGLE_MAPS_ANDROID_API_KEY = 'AIzaTestOnlyKey';
  try {
    jest.isolateModules(() => {
      const withKey = jest.requireActual('../../app.config').default;
      expect(withKey.android.config.googleMaps.apiKey).toBe('AIzaTestOnlyKey');
      const rest = { ...withKey.android };
      delete rest.config;
      expect(JSON.stringify({ ...withKey, android: rest })).not.toMatch(/AIza/);
    });
  } finally {
    if (before === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = before;
  }
});

test('without the maps key there is no maps config, and the build still works', () => {
  const before = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  try {
    jest.isolateModules(() => {
      const noKey = jest.requireActual('../../app.config').default;
      expect(noKey.android.config?.googleMaps).toBeUndefined();
    });
  } finally {
    if (before !== undefined) process.env.GOOGLE_MAPS_ANDROID_API_KEY = before;
  }
});
