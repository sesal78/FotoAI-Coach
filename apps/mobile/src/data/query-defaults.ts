// Query and write defaults. The API client fails fast offline with a clear error, so reads and
// writes always run ("always" network mode): a screen then shows its saved answer or the offline
// state, never a spinner that waits for a signal, and a failed write says so.

import { ApiClientError } from '../lib/api';

export const QUERY_DEFAULTS = {
  queries: {
    networkMode: 'always' as const,
    // Retry only what can get better (offline, upstream, rate limit); never a 4xx.
    retry: (count: number, error: unknown) => error instanceof ApiClientError && error.retryable && count < 2,
    staleTime: 30_000,
  },
  mutations: { networkMode: 'always' as const },
};
