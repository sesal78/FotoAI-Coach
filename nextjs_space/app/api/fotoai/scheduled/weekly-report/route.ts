import { createScheduledHandlers } from '@/lib/fotoai/handlers/scheduled.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createScheduledHandlers(getFotoaiDeps);

export const GET = handlers.weeklyReport;
export const POST = handlers.weeklyReport;
