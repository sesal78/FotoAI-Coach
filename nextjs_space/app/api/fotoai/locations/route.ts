import { createLocationHandlers } from '@/lib/fotoai/handlers/locations.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createLocationHandlers(getFotoaiDeps);

export const POST = handlers.scout;
