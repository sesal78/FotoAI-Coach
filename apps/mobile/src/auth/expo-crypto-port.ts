// AES-GCM (expo-crypto, SDK 58) for the session store. expo-crypto seals base64 text, so the
// session's UTF-8 text is turned into base64 first and back after opening.

import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';

import type { CryptoPort } from './storage';

export function utf8ToB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function b64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export const expoCryptoPort: CryptoPort = {
  async newKey() {
    const key = await AESEncryptionKey.generate();
    return key.encoded('base64');
  },
  async seal(plain, keyB64) {
    const key = await AESEncryptionKey.import(keyB64, 'base64');
    const sealed = await aesEncryptAsync(utf8ToB64(plain), key);
    return (await sealed.combined('base64')) as string;
  },
  async open(sealedB64, keyB64) {
    const key = await AESEncryptionKey.import(keyB64, 'base64');
    const out = await aesDecryptAsync(AESSealedData.fromCombined(sealedB64), key, { output: 'base64' });
    return b64ToUtf8(out as string);
  },
};
