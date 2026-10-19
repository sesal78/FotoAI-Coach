import { createEncryptedStorage, type CryptoPort, type KeyValue, type SecretStore } from '../storage';

// Test doubles: a reversible "cipher" is enough to prove the stored value is not the plain JSON.
function fakes() {
  const secrets = new Map<string, string>();
  const kv = new Map<string, string>();
  const secure: SecretStore = {
    get: async (k) => secrets.get(k) ?? null,
    set: async (k, v) => void secrets.set(k, v),
    remove: async (k) => void secrets.delete(k),
  };
  const store: KeyValue = {
    getItem: async (k) => kv.get(k) ?? null,
    setItem: async (k, v) => void kv.set(k, v),
    removeItem: async (k) => void kv.delete(k),
  };
  let generated = 0;
  const crypto: CryptoPort = {
    newKey: async () => `key-${++generated}`,
    seal: async (plain, key) => `${key}:${plain.split('').reverse().join('')}`,
    open: async (sealed, key) => {
      if (!sealed.startsWith(`${key}:`)) throw new Error('bad tag');
      return sealed.slice(key.length + 1).split('').reverse().join('');
    },
  };
  return { secrets, kv, storage: createEncryptedStorage({ secure, kv: store, crypto }), generatedCount: () => generated };
}

const SESSION = JSON.stringify({ access_token: 'eyJ.secret.token', refresh_token: 'r-123', user: { email: 'séun@example.com' } });

test('the session is stored encrypted, never as plain JSON', async () => {
  const { kv, storage } = fakes();
  await storage.setItem('sb-auth', SESSION);
  const raw = [...kv.values()].join('');
  expect(raw).not.toContain('access_token');
  expect(raw).not.toContain('eyJ.secret.token');
  expect(await storage.getItem('sb-auth')).toBe(SESSION);
});

test('one key is made once and kept in the secure store', async () => {
  const { secrets, storage, generatedCount } = fakes();
  await storage.setItem('a', '1');
  await storage.setItem('b', '2');
  expect(generatedCount()).toBe(1);
  expect(secrets.size).toBe(1);
});

test('a value that cannot be opened is removed and reads as signed out', async () => {
  const { kv, storage } = fakes();
  kv.set('sb-auth', 'garbage');
  expect(await storage.getItem('sb-auth')).toBeNull();
  expect(kv.has('sb-auth')).toBe(false);
});

test('removeItem deletes the value', async () => {
  const { kv, storage } = fakes();
  await storage.setItem('sb-auth', SESSION);
  await storage.removeItem('sb-auth');
  expect(kv.size).toBe(0);
  expect(await storage.getItem('sb-auth')).toBeNull();
});

test('a key-store failure keeps the stored session and reports the error', async () => {
  const { kv, storage } = fakes();
  await storage.setItem('sb-auth', SESSION);
  const broken = createEncryptedStorage({
    secure: { get: async () => { throw new Error('keystore not ready'); }, set: async () => undefined, remove: async () => undefined },
    kv: { getItem: async (k) => kv.get(k) ?? null, setItem: async (k, v) => void kv.set(k, v), removeItem: async (k) => void kv.delete(k) },
    crypto: { newKey: async () => 'k', seal: async (p) => p, open: async (p) => p },
  });
  await expect(broken.getItem('sb-auth')).rejects.toThrow('keystore not ready');
  expect(kv.has('sb-auth')).toBe(true);
});
