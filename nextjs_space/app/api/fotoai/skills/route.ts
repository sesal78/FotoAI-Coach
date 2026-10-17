import { createSkillsHandlers } from '@/lib/fotoai/handlers/skills.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createSkillsHandlers(getFotoaiDeps);

export const GET = handlers.get;
