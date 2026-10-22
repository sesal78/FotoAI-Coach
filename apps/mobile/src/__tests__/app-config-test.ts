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
