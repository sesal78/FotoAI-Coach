import { createInsightsHandlers } from '@/lib/fotoai/handlers/insights.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createInsightsHandlers(getFotoaiDeps);

export const GET = handlers.list;
