// FotoAI reverse-engineering handlers (owner-scoped). Replaces app/api/reverse-engineer.
//
//   GET  /api/fotoai/reverse?limit=          list own analyses (signed photoUrl)
//   POST /api/fotoai/reverse  (multipart)    analyse `photo`, store it, save the result
//
// Identity: session cookie only. Any userId in the request is rejected (400).

import { randomUUID } from 'node:crypto';
import { MAX_UPLOAD_REQUEST_BYTES, readBoundedFormData } from '../bounded-body.ts';
import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { validateIncomingPhoto } from '../photos.ts';
import { createReverseRepo } from '../repo-reverse.ts';
import {
  callAi, detectMime, loadAiContext, parseLimit, rejectUnreadableRaw, removeUploaded, signOrNull, toDataUri, toIncomingPhoto,
} from './ai-inputs.ts';
import { type DepsProvider, json, requirePrincipal, withFotoai } from './shared.ts';

const RAW_MESSAGE = 'RAW files cannot be analysed directly by the AI vision model. Please export the photo as JPEG or PNG first.';

export function createReverseHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const limit = parseLimit(params, 20, 50);
      const rows = await createReverseRepo(deps.client).list(principal, { limit });
      const analyses = await Promise.all(rows.map(async (row) => ({
        id: row.id,
        photoUrl: await signOrNull(deps, principal, row.photo_object_key),
        result: row.result,
        analysisDate: row.analysis_date,
      })));
      return json({ analyses });
    }),

    create: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const form = await readBoundedFormData(request, MAX_UPLOAD_REQUEST_BYTES);
      assertNoBrowserIdentity(form);

      const photo = toIncomingPhoto(form.get('photo'), 'photo');
      if (!photo) throw new FotoaiValidationError('photo file required');
      validateIncomingPhoto(photo);
      const data = await photo.bytes();
      const mime = detectMime(data, photo.type || 'image/jpeg');
      rejectUnreadableRaw([{ name: photo.name, mime }], RAW_MESSAGE);

      const { skillLevel, gear } = await loadAiContext(deps, principal);
      // LLM first: nothing is stored when the analysis fails.
      const result = await callAi('reverseEngineerPhoto', () =>
        deps.services.ai.reverseEngineerPhoto({ imageDataUri: toDataUri(data, mime), skillLevel, gear }));

      const id = randomUUID();
      const stored = await deps.photos.storeFeaturePhoto(principal, 'reverse', id, photo);
      let row;
      try {
        row = await createReverseRepo(deps.client).create(principal, { id, photoObjectKey: stored.objectKey, result });
      } catch (err) {
        await removeUploaded(deps, principal, [stored.objectKey]);
        throw err;
      }

      return json({
        analysis: {
          id: row.id,
          photoUrl: await signOrNull(deps, principal, row.photo_object_key),
          result: row.result,
          analysisDate: row.analysis_date,
        },
      }, { status: 201 });
    }),
  };
}
