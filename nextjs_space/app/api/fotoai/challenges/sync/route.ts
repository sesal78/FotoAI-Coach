import { createChallengeSyncHandlers } from '@/lib/fotoai/handlers/challenge-sync.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createChallengeSyncHandlers(getFotoaiDeps);

export const GET = handlers.status;
export const POST = handlers.sync;
