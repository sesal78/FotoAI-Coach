// The Supabase session store on the phone. Values are sealed with AES-GCM under one random key;
// the key lives in the Android Keystore (expo-secure-store) and the sealed values in SQLite
// (expo-sqlite/kv-store), because a session can outgrow what SecureStore is meant to hold.
// A value that cannot be opened (for example after the key was lost) is dropped: the user signs in again.

export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface KeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface CryptoPort {
  /** A new key, encoded as a string. */
  newKey(): Promise<string>;
  /** Seals UTF-8 text; returns one storable string. */
  seal(plain: string, key: string): Promise<string>;
  /** Opens what seal() made; throws when the key or data is wrong. */
  open(sealed: string, key: string): Promise<string>;
}

const KEY_NAME = 'fotoai.session-key.v1';

export function createEncryptedStorage(deps: { secure: SecretStore; kv: KeyValue; crypto: CryptoPort }) {
  let keyPromise: Promise<string> | null = null;

  const key = () => {
    keyPromise ??= (async () => {
      const existing = await deps.secure.get(KEY_NAME);
      if (existing) return existing;
      const made = await deps.crypto.newKey();
      await deps.secure.set(KEY_NAME, made);
      return made;
    })().catch((err) => {
      keyPromise = null;
      throw err;
    });
    return keyPromise;
  };

  return {
    async getItem(name: string): Promise<string | null> {
      const sealed = await deps.kv.getItem(name);
      if (sealed === null) return null;
      try {
        return await deps.crypto.open(sealed, await key());
      } catch {
        await deps.kv.removeItem(name);
        return null;
      }
    },
    async setItem(name: string, value: string): Promise<void> {
      await deps.kv.setItem(name, await deps.crypto.seal(value, await key()));
    },
    async removeItem(name: string): Promise<void> {
      await deps.kv.removeItem(name);
    },
  };
}

export type EncryptedStorage = ReturnType<typeof createEncryptedStorage>;
