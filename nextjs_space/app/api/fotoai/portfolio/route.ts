import { createPortfolioHandlers } from '@/lib/fotoai/handlers/portfolio.ts';
import { getFotoaiDeps } from '@/lib/fotoai/server.ts';

export const dynamic = 'force-dynamic';

const handlers = createPortfolioHandlers(getFotoaiDeps);

export const GET = handlers.list;
export const POST = handlers.create;
