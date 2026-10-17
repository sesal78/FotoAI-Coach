import { createChatHandlers } from '@/lib/fotoai/handlers/chat.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createChatHandlers(getFotoaiDeps);

export const POST = handlers.send;
