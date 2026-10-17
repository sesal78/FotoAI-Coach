import { createChallengeEmailHandlers } from '@/lib/fotoai/handlers/challenge-email.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createChallengeEmailHandlers(getFotoaiDeps);

export const POST = handlers.send;
