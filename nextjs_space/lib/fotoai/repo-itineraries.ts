// Owner-scoped data access for fotoai_itineraries (user token + RLS).

import { requireUuid } from './object-keys.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_ITINERARIES = 'fotoai_itineraries';

export interface ItineraryRow {
  id: string;
  user_id: string;
  location: string;
  title: string | null;
  description: string | null;
  spots: unknown;
  suggested_times: string[] | null;
  weather_conditions: string | null;
  gear_recommendations: string[] | null;
  duration: string | null;
  status: 'generated' | 'scheduled' | 'completed';
  generated_date: string;
  scheduled_date: string | null;
  completed_date: string | null;
  [key: string]: unknown;
}

function owner(scope: OwnerScope): Record<string, string> {
  return { user_id: `eq.${requireUuid(scope.userId, 'session user id')}` };
}

export function createItinerariesRepo(client: FotoaiSupabaseClient) {
  return {
    async list(scope: OwnerScope, limit?: number): Promise<ItineraryRow[]> {
      const n = Number.isFinite(limit) && (limit as number) > 0 ? Math.floor(limit as number) : 10;
      return client.restSelect<ItineraryRow>(
        T_ITINERARIES,
        { ...owner(scope), select: '*', order: 'generated_date.desc', limit: String(Math.min(n, 50)) },
        scope.accessToken,
      );
    },

    async insert(scope: OwnerScope, row: Omit<Partial<ItineraryRow>, 'id' | 'user_id'>): Promise<ItineraryRow> {
      return client.restInsert<ItineraryRow>(
        T_ITINERARIES, { ...row, user_id: requireUuid(scope.userId, 'session user id') }, scope.accessToken,
      );
    },
  };
}

export type ItinerariesRepo = ReturnType<typeof createItinerariesRepo>;
