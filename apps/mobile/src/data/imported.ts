// Which gallery photos each account has already imported (import key → photo id; see importKey
// in photos.ts), kept on the phone, so picking the same photo again says "Already imported" and
// sends nothing.

import Storage from 'expo-sqlite/kv-store';

const keyFor = (owner: string) => `fotoai.imported.v1.${owner}`;

async function load(owner: string): Promise<Record<string, string>> {
  try {
    const parsed: unknown = JSON.parse((await Storage.getItem(keyFor(owner))) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function importedPhoto(owner: string, key: string): Promise<string | null> {
  return (await load(owner))[key] ?? null;
}

export async function rememberImport(owner: string, key: string, photoId: string): Promise<void> {
  const map = await load(owner);
  map[key] = photoId;
  await Storage.setItem(keyFor(owner), JSON.stringify(map));
}

export async function forgetImport(owner: string, key: string): Promise<void> {
  const map = await load(owner);
  if (!(key in map)) return;
  delete map[key];
  await Storage.setItem(keyFor(owner), JSON.stringify(map));
}
