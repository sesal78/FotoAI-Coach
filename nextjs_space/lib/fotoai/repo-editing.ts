// Owner-scoped access to fotoai_editing_recipes (select/insert/delete for users; no update).

import { assertOwnedFeatureKey, requireUuid } from './object-keys.ts';
import { asJsonObject, boundedLimit, ownerFilter, ownerId } from './repo-ai-common.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_EDITING = 'fotoai_editing_recipes';

export interface EditingRecipeRow {
  id: string;
  user_id: string;
  original_photo_object_key: string | null;
  edited_photo_object_key: string | null;
  recipe: Record<string, unknown>;
  analysis_date: string;
}

export function createEditingRepo(client: FotoaiSupabaseClient) {
  return {
    async list(scope: OwnerScope, opts: { limit?: number } = {}): Promise<EditingRecipeRow[]> {
      return client.restSelect<EditingRecipeRow>(T_EDITING, {
        ...ownerFilter(scope),
        select: 'id,user_id,original_photo_object_key,edited_photo_object_key,recipe,analysis_date',
        order: 'analysis_date.desc',
        limit: boundedLimit(opts.limit, 20, 50),
      }, scope.accessToken);
    },

    async create(scope: OwnerScope, input: {
      id: string;
      originalPhotoObjectKey: string;
      editedPhotoObjectKey: string;
      recipe: unknown;
    }): Promise<EditingRecipeRow> {
      const userId = ownerId(scope);
      assertOwnedFeatureKey(input.originalPhotoObjectKey, userId);
      assertOwnedFeatureKey(input.editedPhotoObjectKey, userId);
      return client.restInsert<EditingRecipeRow>(T_EDITING, {
        id: requireUuid(input.id, 'recipe id'),
        user_id: userId,
        original_photo_object_key: input.originalPhotoObjectKey,
        edited_photo_object_key: input.editedPhotoObjectKey,
        recipe: asJsonObject(input.recipe),
        analysis_date: new Date().toISOString(),
      }, scope.accessToken);
    },
  };
}

export type EditingRepo = ReturnType<typeof createEditingRepo>;
