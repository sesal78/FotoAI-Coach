import { json } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/health - liveness of the v2 API. Needs no env and no Supabase. */
export async function GET(): Promise<Response> {
  return json({ status: 'ok', api: 'v2' });
}
