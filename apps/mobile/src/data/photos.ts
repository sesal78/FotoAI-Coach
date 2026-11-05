// Photo hooks (3F). Import: pick photos from the gallery, read their EXIF and place, make each a
// JPEG of at most 3000 px, and queue it in the outbox. An import made offline shows at once as
// "Waiting to upload" and is sent later; the same gallery photo is never sent twice.

import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useState } from 'react';

import { deletePhotoFile } from '../lib/photo-files';
import { preparePhoto } from '../lib/prepare-photo';
import { enqueue, fieldOwner } from './field';
import { importedPhoto, rememberImport } from './imported';
import { photoItem, type PhotoBody } from './upload';

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
