// Query and write defaults. The API client fails fast offline with a clear error, so reads and
// writes always run ("always" network mode): a screen then shows its saved answer or the offline
// state, never a spinner that waits for a signal, and a failed write says so.

import { ApiClientError } from '../lib/api';

/** How long a read is kept on the phone (see persist.ts). */
export const SAVED_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const QUERY_DEFAULTS = {
  queries: {
    // A read is kept in memory as long as on the phone: a read dropped from memory (5 minutes
    // after its screen closes, by default) is also dropped from the saved copy.
    gcTime: SAVED_MAX_AGE,
    networkMode: 'always' as const,
    // Retry only what can get better (offline, upstream, rate limit); never a 4xx.
    retry: (count: number, error: unknown) => error instanceof ApiClientError && error.retryable && count < 2,
    staleTime: 30_000,
  },
  mutations: { networkMode: 'always' as const },
};
