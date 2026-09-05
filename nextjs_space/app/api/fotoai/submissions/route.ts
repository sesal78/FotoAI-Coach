import { createSubmissionHandlers } from '@/lib/fotoai/handlers/submissions.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createSubmissionHandlers(getFotoaiDeps);

export const GET = handlers.list;
export const POST = handlers.create;
