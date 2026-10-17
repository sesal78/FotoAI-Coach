import { createItineraryHandlers } from '@/lib/fotoai/handlers/itineraries.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createItineraryHandlers(getFotoaiDeps);

export const GET = handlers.list;
export const POST = handlers.create;
