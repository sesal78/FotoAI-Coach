// Which gallery photos each account has already imported (gallery id → photo id), kept on the
// phone, so picking the same photo again says "Already imported" and sends nothing.

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

export async function importedPhoto(owner: string, assetId: string): Promise<string | null> {
  return (await load(owner))[assetId] ?? null;
}

export async function rememberImport(owner: string, assetId: string, photoId: string): Promise<void> {
  const map = await load(owner);
  map[assetId] = photoId;
  await Storage.setItem(keyFor(owner), JSON.stringify(map));
}

export async function forgetImport(owner: string, assetId: string): Promise<void> {
  const map = await load(owner);
  if (!(assetId in map)) return;
  delete map[assetId];
  await Storage.setItem(keyFor(owner), JSON.stringify(map));
}
