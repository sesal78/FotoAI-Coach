import { createPreferencesHandlers } from '@/lib/fotoai/handlers/preferences.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createPreferencesHandlers(getFotoaiDeps);

export const GET = handlers.get;
export const PUT = handlers.put;
