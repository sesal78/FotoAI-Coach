// Session cache boundary for FotoAI React Query data.

export interface FotoaiQueryCache {
  removeQueries(filters: { queryKey: readonly string[] }): unknown;
}

export const FOTOAI_QUERY_ROOT = ['fotoai'] as const;

export function clearFotoaiQueryCache(cache: FotoaiQueryCache): void {
  cache.removeQueries({ queryKey: FOTOAI_QUERY_ROOT });
}
