import { tailwindColors } from '@fotoai/ui';

// tailwind.config.js keeps its own key list (it runs in plain Node); it must match the tokens.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../../tailwind.config.js');

test('the Tailwind colours match the @fotoai/ui tokens', () => {
  const ours = Object.keys(config.theme.extend.colors).sort();
  const tokens = Object.values(tailwindColors()).map((v) => /--color-([a-z-]+)/.exec(v)![1]).sort();
  expect(ours).toEqual(tokens);
});

test('the radius names the app uses exist (rounded-pill is not a Tailwind default)', () => {
  expect(config.theme.extend.borderRadius).toMatchObject({ sm: expect.any(String), md: expect.any(String), lg: expect.any(String), pill: '9999px' });
});
