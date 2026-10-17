import { createEditingHandlers } from '@/lib/fotoai/handlers/editing.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createEditingHandlers(getFotoaiDeps);

export const GET = handlers.list;
export const POST = handlers.create;
