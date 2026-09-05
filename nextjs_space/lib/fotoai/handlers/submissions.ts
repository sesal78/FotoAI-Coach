// FotoAI submission handlers (owner-scoped).
//
//   GET    /api/fotoai/submissions?challengeId=&limit=     list own submissions
//   POST   /api/fotoai/submissions  (multipart)             create own submission (+photo)
//   GET    /api/fotoai/submissions/[id]                     read own submission
//   DELETE /api/fotoai/submissions/[id]                     delete own submission (+photo)
//   GET    /api/fotoai/submissions/[id]/photo?ttl=          short-lived signed URL
//
// Identity: session cookie only. Any userId in the request is rejected (400).

import { MAX_UPLOAD_REQUEST_BYTES, readBoundedFormData } from '../bounded-body.ts';
import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import type { IncomingPhoto } from '../photos.ts';
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

export function createSubmissionHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const submissions = await deps.repo.listSubmissions(principal, {
        challengeId: params.get('challengeId') ?? undefined,
        limit: params.has('limit') ? Number(params.get('limit')) : undefined,
      });
      return json({ submissions });
    }),

    create: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      // Size gate BEFORE the body is buffered (411 without Content-Length,
      // 413 when declared or actual size exceeds the limit).
      const form = await readBoundedFormData(request, MAX_UPLOAD_REQUEST_BYTES);
      assertNoBrowserIdentity(form);

      const challengeId = form.get('challengeId');
      if (typeof challengeId !== 'string' || !challengeId) {
        throw new FotoaiValidationError('challengeId is required');
      }
      const notes = typeof form.get('notes') === 'string' ? (form.get('notes') as string) : '';
      const ratingRaw = form.get('rating');
      const rating = typeof ratingRaw === 'string' && ratingRaw !== '' ? Number(ratingRaw) : null;
      const photo = toIncomingPhoto(form.get('photo'));

      const challenge = await deps.repo.getChallenge(principal, challengeId); // 404 if not ours
      let submission = await deps.repo.createSubmission(principal, { challengeId: challenge.id, notes, rating });

      if (photo) {
        const stored = await deps.photos.storeSubmissionPhoto(principal, submission.id, photo);
        submission = await deps.repo.updateSubmission(principal, submission.id, {
          photo_object_key: stored.objectKey,
          photo_mime: stored.mime,
          photo_bytes: stored.bytes,
        });
      }

      await deps.repo.updateChallengeStatus(principal, challenge.id, 'completed');
      await deps.repo.recordCompletion(principal, challenge);
      await deps.repo.logAgentAction(principal, 'CHALLENGE_COMPLETED', {
        challengeId: challenge.id,
        submissionId: submission.id,
        hasPhoto: Boolean(submission.photo_object_key),
        rating,
      });

      return json({
        submission,
        message: submission.photo_object_key
          ? 'Challenge submitted with photo.'
          : 'Challenge submitted.',
      }, { status: 201 });
    }),

    get: withFotoai(provider, async (request, deps, { params }) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const submission = await deps.repo.getSubmission(principal, params.id);
      return json({ submission });
    }),

    remove: withFotoai(provider, async (request, deps, { params }) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const removed = await deps.repo.deleteSubmission(principal, params.id); // 404 if not ours
      if (removed.photo_object_key) {
        await deps.photos.removeOwnedObject(principal, removed.photo_object_key);
      }
      return json({ success: true, id: removed.id });
    }),

    photo: withFotoai(provider, async (request, deps, { params }) => {
      const principal = await requirePrincipal(request, deps);
      const search = new URL(request.url).searchParams;
      assertNoBrowserIdentity(search);
      const ttl = search.has('ttl') ? Number(search.get('ttl')) : undefined;
      const signed = await deps.photos.signSubmissionPhoto(principal, params.id, ttl);
      return json({ url: signed.url, expiresIn: signed.expiresIn });
    }),
  };
}
