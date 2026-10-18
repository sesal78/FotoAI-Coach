// Service-role client: bypasses RLS. Import only from privileged/ folders (lint enforces
// it); callers must have proven ownership first (spec section 3).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ServerEnv } from '@fotoai/env';

import type { Database } from './types.gen.ts';
import { NO_SESSION_AUTH } from './user-client.ts';

export type ServiceClient = SupabaseClient<Database> & { readonly __service: true };

export function createServiceClient(
  env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_SERVICE_ROLE_KEY'>,
): ServiceClient {
  return createClient<Database>(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_SERVICE_ROLE_KEY, {
    auth: NO_SESSION_AUTH,
  }) as ServiceClient;
}
