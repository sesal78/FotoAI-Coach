import { createGearHandlers } from '@/lib/fotoai/handlers/gear.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createGearHandlers(getFotoaiDeps);

export const DELETE = handlers.remove;
