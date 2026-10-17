// Retired Appwrite route (P4 port, 95-P4-PORT-PLAN.md). No replacement.
// The old code trusted a caller-supplied userId; it is kept only in git history.
import { retiredRoute } from '@/lib/retired-route';

export const dynamic = 'force-dynamic';

const gone = retiredRoute(null);

export const GET = gone;
