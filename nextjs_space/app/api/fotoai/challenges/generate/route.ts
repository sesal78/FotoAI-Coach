import { createChallengeHandlers } from '@/lib/fotoai/handlers/challenges.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createChallengeHandlers(getFotoaiDeps);

export const POST = handlers.generate;
