// GET /api/v2/me: who the session belongs to.

import { z } from 'zod';

export const MeResponse = z.object({ userId: z.string().uuid(), email: z.string().nullable() });

export type MeResponse = z.infer<typeof MeResponse>;
