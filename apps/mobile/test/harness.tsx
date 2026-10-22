// Screen-test harness: the theme, a fresh query client and safe-area metrics, plus a fake API
// that answers by "METHOD /path" and records every call (no network).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../src/ui/ThemeProvider';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export async function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={client}>
        <ThemeProvider initial="golden">{ui}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return { client, ...result };
}

type Answer = unknown | ((body: unknown, path: string) => unknown);

export function fakeApi(routes: Record<string, Answer>) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const request = jest.fn(async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, path, body: opts.body });
    const key = `${method} ${path.split('?')[0]}`;
    if (!(key in routes)) throw new Error(`fake api: no route for ${key}`);
    const route = routes[key];
    const value = typeof route === 'function' ? await (route as (b: unknown, p: string) => unknown)(opts.body, path) : route;
    if (value instanceof Error) throw value;
    return value;
  });
  return { request, calls };
}
