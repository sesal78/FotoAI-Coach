// FotoAI photo critique handlers (owner-scoped).
//
//   GET  /api/fotoai/critiques?submissionId=&limit=   list own critiques
//   GET  /api/fotoai/critiques/[id]                   read own critique
//   POST /api/fotoai/critiques  (multipart)           photo OR submissionId, optional challengeText
//
// Identity: session cookie only. Any userId in the request is rejected (400).

import { MAX_UPLOAD_REQUEST_BYTES, readBoundedFormData } from '../bounded-body.ts';
import { createCritique, toCritiqueDto } from '../critiques.ts';
import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import type { IncomingPhoto } from '../photos.ts';
import { reserveLlmCall } from '../rate-limit.ts';
import { createCritiquesRepo, DEFAULT_CRITIQUE_LIMIT, MAX_CRITIQUE_LIMIT } from '../repo-critiques.ts';
import { parseListLimit } from '../repo-insights.ts';
import { type DepsProvider, json, requirePrincipal, withFotoai } from './shared.ts';

function toIncomingPhoto(value: FormDataEntryValue | null): IncomingPhoto | null {
  if (!value || typeof value === 'string') return null;
  const file = value as File;
  if (!file.size) return null;
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
  };
}

function optionalText(form: FormData, field: string): string | null {
  const value = form.get(field);
  if (value === null) return null;
  if (typeof value !== 'string') throw new FotoaiValidationError(`${field} must be a text field`);
  return value;
}

export function createCritiqueHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const submissionId = params.get('submissionId');
      const limit = parseListLimit(params.get('limit'), DEFAULT_CRITIQUE_LIMIT, MAX_CRITIQUE_LIMIT);
      const rows = await createCritiquesRepo(deps.client).listCritiques(principal, {
        submissionId: submissionId === null || submissionId === '' ? undefined : submissionId,
        limit,
      });
      const critiques = await Promise.all(rows.map((row) => toCritiqueDto(deps, principal, row)));
      return json({ critiques });
    }),

    get: withFotoai(provider, async (request, deps, { params }) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const row = await createCritiquesRepo(deps.client).getCritique(principal, params.id); // 404 if not ours
      return json({ critique: await toCritiqueDto(deps, principal, row) });
    }),

    create: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      // Size gate BEFORE the body is buffered (411 / 413).
      const form = await readBoundedFormData(request, MAX_UPLOAD_REQUEST_BYTES);
      assertNoBrowserIdentity(form);

      const submissionId = optionalText(form, 'submissionId');
      const challengeText = optionalText(form, 'challengeText');
      await reserveLlmCall(deps.client, principal, 'critique');
      const { critique } = await createCritique(deps, principal, {
        photo: toIncomingPhoto(form.get('photo')),
        submissionId: submissionId === '' ? null : submissionId,
        challengeText,
      });
      return json({ critique: await toCritiqueDto(deps, principal, critique) }, { status: 201 });
    }),
  };
}
