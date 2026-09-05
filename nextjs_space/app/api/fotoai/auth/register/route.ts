import { createAuthHandlers } from '@/lib/fotoai/handlers/auth.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createAuthHandlers(getFotoaiDeps);

export const POST = handlers.register;
