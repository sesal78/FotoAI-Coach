// Lint config for the refactor workspace (packages/*, apps/*, services/*).
// nextjs_space/ is the live app; it keeps its own config until it is retired.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'nextjs_space/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      'packages/db/src/types.gen.ts',
      // drizzle-kit pull output: kept byte-identical so the baseline drift test stays exact
      'packages/db/src/schema/**',
      'packages/db/drizzle/**',
      // Expo: generated types and native folders
      'apps/mobile/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/mobile/expo-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Expo, Metro, Babel and Jest read these CommonJS config files in Node.
    files: ['apps/mobile/*.config.js', 'apps/mobile/test/*.js', 'scripts/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly', __dirname: 'readonly', process: 'readonly', console: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // The service-role client bypasses RLS: only guarded helpers in privileged/ folders may use it.
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    ignores: ['packages/db/**', '**/src/privileged/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@fotoai/db/service',
              message: 'The service-role client bypasses RLS. Use it only from a src/privileged/ helper that checks ownership.',
            },
          ],
        },
      ],
    },
  },
);
