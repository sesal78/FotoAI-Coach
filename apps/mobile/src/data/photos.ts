// Photo hooks (3F). Import: pick photos from the gallery, read their EXIF and place, make each a
// JPEG of at most 3000 px, and queue it in the outbox. An import made offline shows at once as
// "Waiting to upload" and is sent later; the same gallery photo is never sent twice.
// Reads: the library (pages, kept on the phone), one photo (from the saved library first), and
// its signed read link, which lives in memory only, for 4 of its 5 minutes.
// Analyse: the saved AI results are kept on the phone; a new one needs a signal.

import type { AnalysisListResponse as AnalysisList, AnalysisMode, PhotoListResponse as PhotoList, ShootPlanDto } from '@fotoai/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useMemo, useState } from 'react';

import { deletePhotoFile } from '../lib/photo-files';
import { preparePhoto } from '../lib/prepare-photo';
import { getApi } from './client';
import { enqueue, fieldOwner, outbox } from './field';
import { importedPhoto, rememberImport } from './imported';
import { keys } from './keys';
import type { OutboxItem } from './outbox';
import { AnalyseResponse, AnalysisListResponse, PhotoListResponse, PhotoResponse, PhotoUrlResponse } from './schemas';
import { useOutbox } from './shoot';
import { photoItem, type PhotoBody } from './upload';

/** The link lasts 300 s on the server: it is used for 4 minutes, then fetched again. */
const LINK_FRESH_MS = 4 * 60 * 1000;

/** The ready photos, newest first, a page at a time. Kept on the phone. */
export function usePhotos() {
  const query = useInfiniteQuery({
    queryKey: keys.photos,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getApi().request(`/api/v2/photos${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, { schema: PhotoListResponse }),
    getNextPageParam: (last) => last.nextCursor,
  });
  const photos = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap((p) => p.photos).filter((p) => p.status === 'ready' && !seen.has(p.id) && seen.add(p.id));
  }, [query.data]);
  return { ...query, photos };
}

/** One photo: from the saved library first (it opens with no signal), then from the server. */
export function usePhoto(id: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: keys.photo(id),
    queryFn: () => getApi().request(`/api/v2/photos/${encodeURIComponent(id)}`, { schema: PhotoResponse }),
    initialData: () => {
      const found = client.getQueryData<InfiniteData<PhotoList>>(keys.photos)?.pages.flatMap((p) => p.photos).find((p) => p.id === id);
      return found ? { photo: found } : undefined;
    },
    initialDataUpdatedAt: () => client.getQueryState(keys.photos)?.dataUpdatedAt,
  });
}

/** The photo's signed read link. Never saved on the phone; the picture asks again when it fails. */
export function usePhotoUrl(id: string) {
  return useQuery({
    queryKey: keys.photoUrl(id),
    meta: { save: false },
    staleTime: LINK_FRESH_MS,
    gcTime: LINK_FRESH_MS,
    queryFn: () => getApi().request(`/api/v2/photos/${encodeURIComponent(id)}/url`, { schema: PhotoUrlResponse }),
  });
}

/** A photo's AI results, newest first. Kept on the phone, so they show with no signal. */
export function useAnalyses(photoId: string) {
  return useQuery({
    queryKey: keys.analyses(photoId),
    queryFn: () => getApi().request(`/api/v2/photos/${encodeURIComponent(photoId)}/analyses`, { schema: AnalysisListResponse }),
  });
}

/**
 * Asks the AI about a photo (it costs an AI call): only from a tap, never queued for later and
 * never sent again by itself. The new result goes first in the saved list. The photo is read
 * again (the server checks a photo that was not checked yet), and so is the progress (a critique
 * gives XP).
 */
export function useAnalyse(photoId: string) {
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: (mode: AnalysisMode) =>
      getApi().request(`/api/v2/photos/${encodeURIComponent(photoId)}/analyse`, { method: 'POST', body: { mode }, schema: AnalyseResponse }),
    onSuccess: ({ analysis }) => {
      client.setQueryData<AnalysisList>(keys.analyses(photoId), (old) => ({ analyses: [analysis, ...(old?.analyses ?? []).filter((a) => a.id !== analysis.id)] }));
      void client.invalidateQueries({ queryKey: keys.photo(photoId) });
      if (analysis.mode === 'critique') void client.invalidateQueries({ queryKey: keys.progress });
    },
  });
}

/** A film roll's scans on FotoAI, oldest first, with the frame each one is paired with. Kept on the phone. */
export function useRollScans(rollId: string) {
  return useQuery({
    queryKey: keys.rollScans(rollId),
    queryFn: async () => {
      const photos: PhotoList['photos'] = [];
      let cursor: string | null = null;
      // A roll has at most 72 frames plus spares: two pages of 50 at most.
      for (let page = 0; page < 3; page += 1) {
        const query: string = `rollId=${encodeURIComponent(rollId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const answer: PhotoList = await getApi().request(`/api/v2/photos?${query}`, { schema: PhotoListResponse });
        photos.push(...answer.photos);
        cursor = answer.nextCursor;
        if (!cursor) break;
      }
      return { scans: photos.filter((p) => p.source === 'scan').reverse() };
    },
  });
}

/**
 * Saves the pairs of scans and frames: one outbox item, after the scans' own uploads, so it is
 * sent only once they are done. Every pair goes as a choice. An unsent older save for this roll
 * is replaced, so the newest pairs are the ones sent.
 */
export function useSaveScans(rollId: string) {
  return useCallback(
    async (pairs: Array<{ photoId: string; frameNo: number | null }>) => {
      const owner = fieldOwner();
      if (!owner) throw new Error('Sign in to save this change.');
      for (const item of await outbox.list(owner)) {
        if (item.kind === 'scans' && item.state === 'waiting' && item.key.startsWith(`scans:${rollId}:`)) await outbox.remove(item.id);
      }
      const overrides = Object.fromEntries(pairs.filter((p) => p.frameNo !== null).map((p) => [p.photoId, p.frameNo!]));
      await enqueue({
        kind: 'scans',
        method: 'POST',
        path: `/api/v2/rolls/${encodeURIComponent(rollId)}/scans`,
        body: { photoIds: pairs.map((p) => p.photoId), overrides },
        key: `scans:${rollId}:${Crypto.randomUUID()}`,
      });
    },
    [rollId],
  );
}

/** The photos still in the outbox for this account: waiting, or refused by the server. */
export function useWaitingPhotos(): Array<{ item: OutboxItem; body: PhotoBody }> {
  const items = useOutbox();
  return useMemo(() => items.filter((i) => i.kind === 'photo').map((item) => ({ item, body: item.body as PhotoBody })), [items]);
}

/** The step a photo is linked to, with its plan, when that plan is saved on the phone. */
export function useLinkedStep(stepId: string | null): { planId: string; placeName: string | null; title: string } | null {
  const client = useQueryClient();
  return useMemo(() => {
    if (!stepId) return null;
    for (const q of client.getQueryCache().findAll({ queryKey: ['shoot', 'plan'] })) {
      const plan = (q.state.data as { plan?: ShootPlanDto } | undefined)?.plan;
      const step = plan?.steps.find((s) => s.id === stepId);
      if (plan && step) return { planId: plan.id, placeName: plan.placeName, title: step.title };
    }
    return null;
  }, [client, stepId]);
}

/** At most this many photos in one pick (the server takes 200 new photos an hour). */
export const PICK_LIMIT = 30;

export interface ImportOptions {
  source?: 'gallery' | 'scan';
  rollId?: string;
  stepId?: string;
}

export interface ImportResult {
  added: number;
  already: number;
  failed: number;
  /** The new photos' ids, in the order picked (for scans: the order of the frames). */
  ids: string[];
  /** What to tell the user, or null when nothing was picked. */
  message: string | null;
}

/**
 * Read access to photos and their place. Asked only while Android may still ask; without it a
 * photo is still imported, with the place from its own EXIF (if any).
 */
async function photoAccess(): Promise<boolean> {
  try {
    const now = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (now.granted) return true;
    if (!now.canAskAgain) return false;
    return (await MediaLibrary.requestPermissionsAsync(false, ['photo'])).granted;
  } catch {
    return false;
  }
}

async function placeOf(assetId: string | null | undefined, allowed: boolean): Promise<{ latitude: number; longitude: number } | null> {
  if (!allowed || !assetId) return null;
  try {
    return await new MediaLibrary.Asset(assetId).getLocation();
  } catch {
    return null;
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function messageFor({ added, already, failed }: Pick<ImportResult, 'added' | 'already' | 'failed'>): string {
  const parts: string[] = [];
  if (added) parts.push(`${plural(added, 'photo')} waiting to upload`);
  if (already) parts.push(added || failed ? `${already} already imported` : 'Already imported');
  if (failed) parts.push(`${plural(failed, 'photo')} could not be read`);
  return parts.join('. ');
}

export function useImport() {
  const [busy, setBusy] = useState(false);

  const importPhotos = useCallback(async (opts: ImportOptions = {}): Promise<ImportResult> => {
    const owner = fieldOwner();
    if (!owner) throw new Error('Sign in to import photos.');
    setBusy(true);
    try {
      const allowed = await photoAccess();
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: PICK_LIMIT, exif: true, quality: 1 });
      if (picked.canceled || !picked.assets?.length) return { added: 0, already: 0, failed: 0, ids: [], message: null };

      const count = { added: 0, already: 0, failed: 0 };
      const ids: string[] = [];
      for (const asset of picked.assets) {
        if (asset.assetId && (await importedPhoto(owner, asset.assetId))) {
          count.already += 1;
          continue;
        }
        const id = Crypto.randomUUID();
        let file: string | null = null;
        try {
          const prepared = await preparePhoto(asset, id, await placeOf(asset.assetId, allowed));
          file = prepared.file;
          const body: PhotoBody = {
            id,
            source: opts.source ?? 'gallery',
            mime: prepared.mime,
            bytes: prepared.bytes,
            ...(Object.keys(prepared.exif).length ? { exif: prepared.exif } : {}),
            ...(opts.stepId ? { stepId: opts.stepId } : {}),
            ...(opts.rollId ? { rollId: opts.rollId } : {}),
            file: prepared.file,
            ...(asset.assetId ? { assetId: asset.assetId } : {}),
          };
          await enqueue(photoItem(body));
        } catch {
          if (file) deletePhotoFile(file);
          count.failed += 1;
          continue;
        }
        if (asset.assetId) await rememberImport(owner, asset.assetId, id);
        count.added += 1;
        ids.push(id);
      }
      return { ...count, ids, message: messageFor(count) };
    } finally {
      setBusy(false);
    }
  }, []);

  return { importPhotos, busy };
}
