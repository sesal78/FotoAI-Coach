// Privileged writes to v2 photos (service role). Users may not write a photo's status, key or AI
// check (column grants, migration 20261020100001), so marking a photo ready and saving its check
// happen here. Callers must have read the photo with the user's token first, so it is the caller's;
// every write is also limited to that user's row.

import { createServiceClient } from '@fotoai/db/service';
import type { ServerEnv } from '@fotoai/env';

import { ApiError } from '../handler.ts';

type PhotoEnv = Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_SERVICE_ROLE_KEY'>;

export type ServerPhotoPatch =
  | { status: 'ready'; object_key: string; step_id: string | null; updated_at: string }
  | { check_safe: boolean; check_matches: 'yes' | 'no' | 'unclear' | null; check_genre: string; checked_at: string; check_prompt: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Applies the patch to the user's photo and returns the row with `columns`, or null when there is none. */
export async function writePhoto(env: PhotoEnv, userId: string, photoId: string, patch: ServerPhotoPatch, columns: string): Promise<unknown> {
  if (!UUID.test(userId) || !UUID.test(photoId)) throw new ApiError('validation', 'A photo write needs a user and a photo id');
  const { data, error } = await createServiceClient(env)
    .from('fotoai_photos')
    .update(patch as never)
    .eq('id', photoId)
    .eq('user_id', userId)
    .select(columns)
    .maybeSingle();
  if (error) throw new ApiError('upstream', 'Could not save the photo');
  return data;
}
