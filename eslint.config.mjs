// Lint config for the refactor workspace (packages/*, apps/*, services/*).
// nextjs_space/ is the live app; it keeps its own config until it is retired.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['nextjs_space/**', '**/node_modules/**', '**/dist/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
