// Shared input helpers for the FotoAI vision handlers (reverse, editing, portfolio).
//
// Builds the same LLM inputs the legacy (pre-Supabase) routes built: the caller's
// skill level and gear (now read owner-scoped), image data URIs, and the RAW
// rejection rule from the old editing-recipe route.

import { FotoaiError, FotoaiUpstreamError, FotoaiValidationError } from '../errors.ts';
import type { IncomingPhoto } from '../photos.ts';
import type { OwnerScope } from '../repository.ts';
import type { FotoaiDeps } from './shared.ts';

/** Signed photo URLs in list/create responses. History cards open later, so use the max TTL. */
export const AI_PHOTO_URL_TTL_SECONDS = 300;

const LEGACY_GEAR_LIMIT = 20;
const RAW_EXTENSIONS = ['.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.raw'];
const VISION_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Turns a multipart entry into an IncomingPhoto (bytes read once and cached). */
export function toIncomingPhoto(value: FormDataEntryValue | null, field: string): IncomingPhoto | null {
  if (value === null) return null;
  if (typeof value === 'string') throw new FotoaiValidationError(`${field} must be a file`);
  const file = value as File;
  if (!file.size) return null;
  let cached: Uint8Array | undefined;
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    bytes: async () => (cached ??= new Uint8Array(await file.arrayBuffer())),
  };
}

/** Detects MIME from magic bytes; RAW files report wrong MIME types (legacy rule). */
export function detectMime(bytes: Uint8Array, fallback: string): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
  return fallback;
}

/** Rejects a RAW file the vision model cannot read (400, legacy message). */
export function rejectUnreadableRaw(photos: Array<{ name: string; mime: string }>, message: string): void {
  const unreadable = photos.some(({ name, mime }) => {
    const ext = (name || '').toLowerCase().match(/\.\w+$/)?.[0] || '';
    return RAW_EXTENSIONS.includes(ext) && !VISION_MIMES.includes(mime);
  });
  if (unreadable) throw new FotoaiValidationError(message);
}

export function toDataUri(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

/** Skill level + "brand model" gear strings for the session user (owner-scoped). */
export async function loadAiContext(deps: FotoaiDeps, scope: OwnerScope): Promise<{ skillLevel: string; gear: string[] }> {
  const [prefs, gear] = await Promise.all([deps.repo.getPreferences(scope), deps.repo.listGear(scope)]);
  return {
    skillLevel: prefs.skillLevel || 'intermediate',
    gear: gear.slice(0, LEGACY_GEAR_LIMIT).map((g) => `${g.brand} ${g.model}`),
  };
}

/** Runs an LLM call; any failure becomes a clean 502 (details go to the log only). */
export async function callAi<T>(name: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof FotoaiError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new FotoaiUpstreamError(0, `${name} failed: ${message}`);
  }
}

/** Optional ?limit= : absent -> fallback; otherwise an integer 1..max or 400. */
export function parseLimit(params: URLSearchParams, fallback: number, max: number): number {
  const raw = params.get('limit');
  if (raw === null) return fallback;
  if (!/^\d{1,4}$/.test(raw) || Number(raw) < 1 || Number(raw) > max) {
    throw new FotoaiValidationError(`limit must be an integer from 1 to ${max}`);
  }
  return Number(raw);
}

/** Signs a key from the caller's own row; a legacy/odd key yields null instead of failing the list. */
export async function signOrNull(deps: FotoaiDeps, scope: OwnerScope, key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  try {
    return await deps.photos.signOwnedKey(scope, key, AI_PHOTO_URL_TTL_SECONDS);
  } catch (err) {
    if (!(err instanceof FotoaiError)) throw err;
    deps.log?.('warn', 'Could not sign FotoAI photo key', { code: err.code });
    return null;
  }
}

/** Best-effort removal of objects uploaded for a row that was never written. */
export async function removeUploaded(deps: FotoaiDeps, scope: OwnerScope, keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await deps.photos.removeOwnedObject(scope, key);
    } catch (err) {
      deps.log?.('error', 'Could not remove orphaned FotoAI photo', { message: err instanceof Error ? err.message : String(err) });
    }
  }
}
