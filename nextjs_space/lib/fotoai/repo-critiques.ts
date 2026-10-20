// Owner-scoped access to fotoai_photo_critiques.
//
// Users have SELECT / INSERT / DELETE on this table (no UPDATE), so a
// critique row is written once, complete. Every read filters on the session
// user's id and uses the user's token; rows of another user are 404.

import { FotoaiNotFoundError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

export interface CritiqueRow {
  id: string;
  user_id: string;
  submission_id: string | null;
  photo_object_key: string;
  technical_score: number | null;
  composition_score: number | null;
  creative_score: number | null;
  overall_score: number | null;
  technical_feedback: string | null;
  composition_feedback: string | null;
  creative_feedback: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
  suggested_settings: string | null;
  critique_date: string;
  [key: string]: unknown;
}

export interface NewCritique {
  id: string;
  submissionId: string | null;
  photoObjectKey: string;
  technicalScore: number | null;
  compositionScore: number | null;
  creativeScore: number | null;
  overallScore: number | null;
  technicalFeedback: string | null;
  compositionFeedback: string | null;
  creativeFeedback: string | null;
  strengths: string[];
  improvements: string[];
  suggestedSettings: string | null;
}

export const T_CRITIQUES = 'fotoai_photo_critiques';
export const DEFAULT_CRITIQUE_LIMIT = 20;
export const MAX_CRITIQUE_LIMIT = 50;

function owner(scope: OwnerScope): Record<string, string> {
  return { user_id: `eq.${requireUuid(scope.userId, 'session user id')}` };
}

/** The complete row for one new critique. The owner comes from the scope, never from input. */
export function critiqueInsertRow(scope: OwnerScope, input: NewCritique): Record<string, unknown> {
  return {
    id: requireUuid(input.id, 'critique id'),
    user_id: requireUuid(scope.userId, 'session user id'),
    submission_id: input.submissionId === null ? null : requireUuid(input.submissionId, 'submissionId'),
    photo_object_key: input.photoObjectKey,
    technical_score: input.technicalScore,
    composition_score: input.compositionScore,
    creative_score: input.creativeScore,
    overall_score: input.overallScore,
    technical_feedback: input.technicalFeedback,
    composition_feedback: input.compositionFeedback,
    creative_feedback: input.creativeFeedback,
    strengths: input.strengths,
    improvements: input.improvements,
    suggested_settings: input.suggestedSettings,
    critique_date: new Date().toISOString(),
  };
}

export function createCritiquesRepo(client: FotoaiSupabaseClient) {
  return {
    async listCritiques(scope: OwnerScope, opts: { submissionId?: string; limit?: number } = {}): Promise<CritiqueRow[]> {
      const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? DEFAULT_CRITIQUE_LIMIT)), MAX_CRITIQUE_LIMIT);
      const query: Record<string, string> = {
        ...owner(scope),
        // v2 editing and recreate analyses share the table (refactor 3B); the live pages show critiques only.
        mode: 'eq.critique',
        select: '*',
        order: 'critique_date.desc',
        limit: String(limit),
      };
      if (opts.submissionId !== undefined) {
        query.submission_id = `eq.${requireUuid(opts.submissionId, 'submissionId')}`;
      }
      return client.restSelect<CritiqueRow>(T_CRITIQUES, query, scope.accessToken);
    },

    async getCritique(scope: OwnerScope, critiqueId: string): Promise<CritiqueRow> {
      const id = requireUuid(critiqueId, 'critique id');
      const rows = await client.restSelect<CritiqueRow>(
        T_CRITIQUES, { ...owner(scope), id: `eq.${id}`, mode: 'eq.critique', select: '*', limit: '1' }, scope.accessToken,
      );
      if (rows.length !== 1) throw new FotoaiNotFoundError('Critique not found');
      return rows[0];
    },

    async insertCritique(scope: OwnerScope, input: NewCritique): Promise<CritiqueRow> {
      return client.restInsert<CritiqueRow>(T_CRITIQUES, critiqueInsertRow(scope, input), scope.accessToken);
    },
  };
}

export type FotoaiCritiquesRepo = ReturnType<typeof createCritiquesRepo>;
