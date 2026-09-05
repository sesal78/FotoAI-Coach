import { createGearHandlers } from '@/lib/fotoai/handlers/gear.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createGearHandlers(getFotoaiDeps);

export const GET = handlers.list;
export const POST = handlers.create;
