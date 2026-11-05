// The photo files waiting to upload: one JPEG per photo in the app's own documents folder, so the
// system does not clear it while the phone is offline. It is deleted once the server confirms the
// photo, or when the user removes the waiting photo.

import { Directory, File, Paths } from 'expo-file-system';

export function uploadFile(photoId: string): File {
  const folder = new Directory(Paths.document, 'uploads');
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  return new File(folder, `${photoId}.jpg`);
}

export async function readPhotoFile(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}

/** Deletes the file if it is still there. Never throws: a missing file is already deleted. */
export function deletePhotoFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Nothing to do: the next import uses a new file name.
  }
}
