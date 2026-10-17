// FotoAI editing-recipe handlers (owner-scoped). Replaces app/api/editing-recipe.
//
//   GET  /api/fotoai/editing?limit=          list own recipes (signed photo URLs)
//   POST /api/fotoai/editing  (multipart)    compare originalPhoto + editedPhoto, store both, save the recipe
//
// Identity: session cookie only. Any userId in the request is rejected (400).

import { randomUUID } from 'node:crypto';
import { MAX_UPLOAD_REQUEST_BYTES, readBoundedFormData } from '../bounded-body.ts';
import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import { validateIncomingPhoto } from '../photos.ts';
import { createEditingRepo } from '../repo-editing.ts';
import {
  callAi, detectMime, loadAiContext, parseLimit, rejectUnreadableRaw, removeUploaded, signOrNull, toDataUri, toIncomingPhoto,
} from './ai-inputs.ts';
import { type DepsProvider, json, requirePrincipal, withFotoai } from './shared.ts';

const RAW_MESSAGE = 'RAW files cannot be analysed directly by the AI vision model. Please export both photos as JPEG or PNG first.';

export function createEditingHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const limit = parseLimit(params, 20, 50);
      const rows = await createEditingRepo(deps.client).list(principal, { limit });
      const recipes = await Promise.all(rows.map(async (row) => ({
        id: row.id,
        originalPhotoUrl: await signOrNull(deps, principal, row.original_photo_object_key),
        editedPhotoUrl: await signOrNull(deps, principal, row.edited_photo_object_key),
        recipe: row.recipe,
        analysisDate: row.analysis_date,
      })));
      return json({ recipes });
    }),

    create: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const form = await readBoundedFormData(request, MAX_UPLOAD_REQUEST_BYTES);
      assertNoBrowserIdentity(form);

      const original = toIncomingPhoto(form.get('originalPhoto'), 'originalPhoto');
      const edited = toIncomingPhoto(form.get('editedPhoto'), 'editedPhoto');
      if (!original || !edited) {
        throw new FotoaiValidationError('Both originalPhoto and editedPhoto are required');
      }
      validateIncomingPhoto(original);
      validateIncomingPhoto(edited);
      const [originalData, editedData] = await Promise.all([original.bytes(), edited.bytes()]);
      const originalMime = detectMime(originalData, original.type || 'image/jpeg');
      const editedMime = detectMime(editedData, edited.type || 'image/jpeg');
      rejectUnreadableRaw([
        { name: original.name, mime: originalMime },
        { name: edited.name, mime: editedMime },
      ], RAW_MESSAGE);

      const { skillLevel, gear } = await loadAiContext(deps, principal);
      // LLM first: nothing is stored when the analysis fails.
      const recipe = await callAi('generateEditingRecipe', () => deps.services.ai.generateEditingRecipe({
        originalImageDataUri: toDataUri(originalData, originalMime),
        editedImageDataUri: toDataUri(editedData, editedMime),
        skillLevel,
        gear,
      }));

      const id = randomUUID();
      const uploaded: string[] = [];
      let row;
      try {
        const storedOriginal = await deps.photos.storeFeaturePhoto(principal, 'editing', id, original);
        uploaded.push(storedOriginal.objectKey);
        const storedEdited = await deps.photos.storeFeaturePhoto(principal, 'editing', id, edited);
        uploaded.push(storedEdited.objectKey);
        row = await createEditingRepo(deps.client).create(principal, {
          id,
          originalPhotoObjectKey: storedOriginal.objectKey,
          editedPhotoObjectKey: storedEdited.objectKey,
          recipe,
        });
      } catch (err) {
        await removeUploaded(deps, principal, uploaded);
        throw err;
      }

      return json({
        recipe: {
          id: row.id,
          originalPhotoUrl: await signOrNull(deps, principal, row.original_photo_object_key),
          editedPhotoUrl: await signOrNull(deps, principal, row.edited_photo_object_key),
          recipe: row.recipe,
          analysisDate: row.analysis_date,
        },
      }, { status: 201 });
    }),
  };
}
