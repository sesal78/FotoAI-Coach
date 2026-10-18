// The Google Places client for a request, and the mapping from its errors to the v2 envelope.
// @fotoai/places cannot throw ApiError (it would import this package back), so it throws
// PlacesError with the same codes, and every call from here goes through `places()`.

import { createPlacesClient, PlacesError, type PlacesClient } from '@fotoai/places';

import { ApiError, type V2Deps } from './handler.ts';

export function toApiError(err: unknown): unknown {
  return err instanceof PlacesError ? new ApiError(err.code, err.message) : err;
}

/** A Places client whose every method throws ApiError instead of PlacesError. */
export function placesFor(deps: V2Deps): PlacesClient {
  const client = createPlacesClient({ key: deps.env.GOOGLE_MAPS_SERVER_API_KEY, fetch: deps.fetch });
  const wrap =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await fn(...args);
      } catch (err) {
        throw toApiError(err);
      }
    };
  return {
    nearby: wrap(client.nearby),
    search: wrap(client.search),
    details: wrap(client.details),
    photoUri: wrap(client.photoUri),
  };
}

/** True when the Google key is set; callers skip Google (and its rate limit) when it is not. */
export const placesConfigured = (deps: V2Deps) => Boolean(deps.env.GOOGLE_MAPS_SERVER_API_KEY);
