// Whether this account finished (or skipped) onboarding on this phone. Kept per account, so a
// second account on the same phone still sees it once.

import Storage from 'expo-sqlite/kv-store';

const key = (userId: string) => `fotoai.onboarding.v1.${userId}`;

export function isOnboarded(userId: string): boolean {
  try {
    return Storage.getItemSync(key(userId)) === 'done';
  } catch {
    return false;
  }
}

export function markOnboarded(userId: string): void {
  try {
    Storage.setItemSync(key(userId), 'done');
  } catch {
    // Not saved: onboarding shows again next time, which is safe.
  }
}
