import { createScheduledHandlers } from '@/lib/fotoai/handlers/scheduled.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createScheduledHandlers(getFotoaiDeps);

export const GET = handlers.weatherMonitor;
export const POST = handlers.weatherMonitor;
