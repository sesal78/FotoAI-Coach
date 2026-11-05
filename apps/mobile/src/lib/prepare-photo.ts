// Gets a picked photo ready to upload: read its EXIF first (saving it again drops the tags), make
// the long side at most 3000 px (never larger), save it as JPEG at quality 0.9 (a HEIC photo too),
// and keep that copy in the app's own folder until the server confirms it.

import type { ExifInput } from '@fotoai/contracts';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { exifToInput } from './exif';
import { deletePhotoFile, uploadFile } from './photo-files';

export const MAX_SIDE_PX = 3000;
const QUALITY = 0.9;

export interface PickedPhoto {
  uri: string;
  exif?: Record<string, unknown> | null;
}

export interface PreparedPhoto {
  file: string;
  mime: 'image/jpeg';
  bytes: number;
  exif: ExifInput;
}

export async function preparePhoto(asset: PickedPhoto, photoId: string, gps: { latitude: number; longitude: number } | null = null): Promise<PreparedPhoto> {
  const exif = exifToInput(asset.exif ?? {}, gps);

  const context = ImageManipulator.manipulate(asset.uri);
  let image = await context.renderAsync();
  // The size comes from the decoded image: the picker may give 0 when it does not know.
  if (Math.max(image.width, image.height) > MAX_SIDE_PX) {
    context.resize(image.width >= image.height ? { width: MAX_SIDE_PX } : { height: MAX_SIDE_PX });
    image.release();
    image = await context.renderAsync();
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
  image.release();
  context.release();

  const temp = new File(saved.uri);
  const target = uploadFile(photoId);
  deletePhotoFile(target.uri);
  await temp.copy(target);
  deletePhotoFile(temp.uri);
  return { file: target.uri, mime: 'image/jpeg', bytes: target.size, exif };
}
