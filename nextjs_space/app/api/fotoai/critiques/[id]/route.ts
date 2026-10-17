import { createCritiqueHandlers } from '@/lib/fotoai/handlers/critiques.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createCritiqueHandlers(getFotoaiDeps);

export const GET = handlers.get;
