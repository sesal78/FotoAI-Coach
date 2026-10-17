// Owner-scoped access to fotoai_reverse_analyses (select/insert/delete for users; no update).

import { assertOwnedFeatureKey, requireUuid } from './object-keys.ts';
import { asJsonObject, boundedLimit, ownerFilter, ownerId } from './repo-ai-common.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_REVERSE = 'fotoai_reverse_analyses';

export interface ReverseAnalysisRow {
  id: string;
  user_id: string;
  photo_object_key: string;
  result: Record<string, unknown>;
  analysis_date: string;
}

export function createReverseRepo(client: FotoaiSupabaseClient) {
  return {
    async list(scope: OwnerScope, opts: { limit?: number } = {}): Promise<ReverseAnalysisRow[]> {
      return client.restSelect<ReverseAnalysisRow>(T_REVERSE, {
        ...ownerFilter(scope),
        select: 'id,user_id,photo_object_key,result,analysis_date',
        order: 'analysis_date.desc',
        limit: boundedLimit(opts.limit, 20, 50),
      }, scope.accessToken);
    },

    /** Inserts with a caller-created id so the photo key and row id match. */
    async create(scope: OwnerScope, input: { id: string; photoObjectKey: string; result: unknown }): Promise<ReverseAnalysisRow> {
      const userId = ownerId(scope);
      assertOwnedFeatureKey(input.photoObjectKey, userId);
      return client.restInsert<ReverseAnalysisRow>(T_REVERSE, {
        id: requireUuid(input.id, 'analysis id'),
        user_id: userId,
        photo_object_key: input.photoObjectKey,
        result: asJsonObject(input.result),
        analysis_date: new Date().toISOString(),
      }, scope.accessToken);
    },
  };
}

export type ReverseRepo = ReturnType<typeof createReverseRepo>;
