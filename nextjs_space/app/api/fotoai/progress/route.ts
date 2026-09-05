import { createProgressHandlers } from '@/lib/fotoai/handlers/progress.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createProgressHandlers(getFotoaiDeps);

export const GET = handlers.get;
