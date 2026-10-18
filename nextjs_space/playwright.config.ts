// End-to-end browser tests against a LOCAL stack only: the app on localhost and a
// local Supabase (Docker) with its Mailpit inbox. Never point these at production.
// How to run: ../docs/testing-e2e.md.

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3007';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(baseURL)) {
  throw new Error(`E2E_BASE_URL must be a local http://localhost:<port> address, got ${baseURL}`);
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000, // real LLM calls
  expect: { timeout: 60_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
