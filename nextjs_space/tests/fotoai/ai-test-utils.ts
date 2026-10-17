// Test utilities for the vision feature tests (reverse, editing, portfolio).

import { request } from './helpers/deps.ts';

export interface TestFile { name: string; type: string; bytes: Uint8Array }

/** A tiny "JPEG" (magic bytes + filler). */
export function jpeg(name = 'shot.jpg', size = 64): TestFile {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return { name, type: 'image/jpeg', bytes };
}

/** A RAW file whose bytes are not a vision-readable image. */
export function raw(name = 'shot.cr2'): TestFile {
  const bytes = new Uint8Array(64);
  bytes.set([0x49, 0x49, 0x2a, 0x00]);
  return { name, type: 'image/x-canon-cr2', bytes };
}

/** Multipart body the way a browser sends FormData (with Content-Length). */
export function multipart(fields: Array<[string, string | TestFile]>): { body: Uint8Array; headers: Record<string, string> } {
  const boundary = 'fotoai-ai-test-boundary';
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [k, v] of fields) {
    if (typeof v === 'string') {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    } else {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${v.name}"\r\nContent-Type: ${v.type}\r\n\r\n`));
      chunks.push(v.bytes);
      chunks.push(enc.encode('\r\n'));
    }
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const body = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { body.set(c, off); off += c.byteLength; }
  return {
    body,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(total) },
  };
}

export function multipartRequest(url: string, fields: Array<[string, string | TestFile]>, cookie?: string): Request {
  const { body, headers } = multipart(fields);
  return request(url, { method: 'POST', cookie, headers, body });
}

/** Records fetch calls for browser-client tests. */
export function recordingFetch(respond: (url: string, init?: RequestInit) => unknown) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return Response.json(respond(url, init));
  };
  return { calls, fetcher };
}

/** Field names a FormData body carries. */
export function formKeys(init?: RequestInit): string[] {
  return init?.body instanceof FormData ? Array.from(init.body.keys()) : [];
}
