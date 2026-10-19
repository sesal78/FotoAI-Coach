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
