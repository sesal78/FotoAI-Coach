// Photo hooks (3F). Import: pick photos from the gallery, read their EXIF and place, make each a
// JPEG of at most 3000 px, and queue it in the outbox. An import made offline shows at once as
// "Waiting to upload" and is sent later; the same gallery photo is never sent twice.
// Reads: the library (pages, kept on the phone), one photo (from the saved library first), and
// its signed read link, which lives in memory only, for 4 of its 5 minutes.

import type { PhotoListResponse as PhotoList, ShootPlanDto } from '@fotoai/contracts';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useMemo, useState } from 'react';

import { deletePhotoFile } from '../lib/photo-files';
import { preparePhoto } from '../lib/prepare-photo';
import { getApi } from './client';
import { enqueue, fieldOwner } from './field';
import { importedPhoto, rememberImport } from './imported';
import { keys } from './keys';
import type { OutboxItem } from './outbox';
import { PhotoListResponse, PhotoResponse, PhotoUrlResponse } from './schemas';
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

function messageFor({ added, already, failed }: Omit<ImportResult, 'message'>): string {
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
      if (picked.canceled || !picked.assets?.length) return { added: 0, already: 0, failed: 0, message: null };

      const count = { added: 0, already: 0, failed: 0 };
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
      }
      return { ...count, message: messageFor(count) };
    } finally {
      setBusy(false);
    }
  }, []);

  return { importPhotos, busy };
}
