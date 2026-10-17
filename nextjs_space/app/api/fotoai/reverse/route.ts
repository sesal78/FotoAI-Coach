import { createReverseHandlers } from '@/lib/fotoai/handlers/reverse.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createReverseHandlers(getFotoaiDeps);

export const GET = handlers.list;
export const POST = handlers.create;
