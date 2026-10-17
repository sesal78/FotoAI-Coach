// Early request-size gate: nothing is buffered beyond the limit.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FotoaiLengthRequiredError,
  FotoaiPayloadTooLargeError,
  MAX_UPLOAD_REQUEST_BYTES,
  boundedRequest,
  readBoundedFormData,
  requireDeclaredLength,
} from '../../lib/fotoai/bounded-body.ts';
import { FotoaiError } from '../../lib/fotoai/errors.ts';

const URL_ = 'http://localhost/api/fotoai/submissions';

function multipartBytes(fields: Record<string, string>, fileBytes: number): { bytes: Uint8Array; contentType: string } {
  const boundary = 'fotoai-test-boundary';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="x.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const enc = new TextEncoder();
  const chunks = [enc.encode(parts.join('')), enc.encode(head), new Uint8Array(fileBytes).fill(0x41), enc.encode(tail)];
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  return { bytes, contentType: `multipart/form-data; boundary=${boundary}` };
}

function streamOf(bytes: Uint8Array, chunkSize = 1024): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= bytes.byteLength) { controller.close(); return; }
      controller.enqueue(bytes.slice(i, i + chunkSize));
      i += chunkSize;
    },
  });
}

function streamedRequest(bytes: Uint8Array, contentType: string, declaredLength: number | null): Request {
  const headers: Record<string, string> = { 'content-type': contentType };
  if (declaredLength !== null) headers['content-length'] = String(declaredLength);
  const init = { method: 'POST', headers, body: streamOf(bytes), duplex: 'half' } as RequestInit;
  return new Request(URL_, init);
}

test('bounded-body: limit constant covers a 50 MB photo plus form overhead', () => {
  assert.ok(MAX_UPLOAD_REQUEST_BYTES > 50 * 1024 * 1024);
  assert.ok(MAX_UPLOAD_REQUEST_BYTES < 52 * 1024 * 1024);
});

test('bounded-body: missing Content-Length -> 411 before any read', () => {
  const req = streamedRequest(new Uint8Array(10), 'multipart/form-data; boundary=x', null);
  assert.throws(() => requireDeclaredLength(req, 1000), FotoaiLengthRequiredError);
  assert.throws(() => boundedRequest(req, 1000), FotoaiLengthRequiredError);
  assert.equal(req.bodyUsed, false, 'body must not have been consumed');
});

test('bounded-body: declared Content-Length above the limit -> 413 before any read', () => {
  const req = streamedRequest(new Uint8Array(10), 'multipart/form-data; boundary=x', 5_000_000);
  assert.throws(() => boundedRequest(req, 1000), FotoaiPayloadTooLargeError);
  assert.equal(req.bodyUsed, false);
});

test('bounded-body: non-numeric Content-Length -> 400', () => {
  const req = new Request(URL_, { method: 'POST', headers: { 'content-length': 'abc' } });
  assert.throws(() => requireDeclaredLength(req, 1000), (e: unknown) => e instanceof FotoaiError && e.status === 400);
});

test('bounded-body: a body that exceeds the limit despite a small declared length is cut at 413', async () => {
  const { bytes, contentType } = multipartBytes({ challengeId: 'c' }, 20_000);
  // Lies about its size.
  const req = streamedRequest(bytes, contentType, 100);
  await assert.rejects(readBoundedFormData(req, 4096), FotoaiPayloadTooLargeError);
});

test('bounded-body: a body within the limit parses normally', async () => {
  const { bytes, contentType } = multipartBytes({ challengeId: 'c', notes: 'hi' }, 300);
  const req = streamedRequest(bytes, contentType, bytes.byteLength);
  const form = await readBoundedFormData(req, 4096);
  assert.equal(form.get('challengeId'), 'c');
  assert.equal(form.get('notes'), 'hi');
  const file = form.get('photo') as File;
  assert.equal(file.size, 300);
  assert.equal(file.type, 'image/jpeg');
});

// ----- JSON bodies (readJsonBody) -----------------------------------------

test('readJsonBody: JSON bodies are capped at 64 KiB by default (413), declared or streamed; at the cap they parse', async () => {
  const { readJsonBody } = await import('../../lib/fotoai/handlers/shared.ts');
  const { MAX_JSON_BODY_BYTES } = await import('../../lib/fotoai/bounded-body.ts');
  assert.equal(MAX_JSON_BODY_BYTES, 64 * 1024);
  const bodyOf = (bytes: number) => JSON.stringify({ pad: 'x'.repeat(bytes - '{"pad":""}'.length) });
  const jsonReq = (body: string, headers: Record<string, string> = {}) =>
    new Request('http://localhost/api/fotoai/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

  const atCap = bodyOf(MAX_JSON_BODY_BYTES);
  assert.equal(new TextEncoder().encode(atCap).byteLength, MAX_JSON_BODY_BYTES);
  assert.equal(((await readJsonBody(jsonReq(atCap))).pad as string).length, MAX_JSON_BODY_BYTES - 10);

  const over = bodyOf(MAX_JSON_BODY_BYTES + 1);
  await assert.rejects(readJsonBody(jsonReq(over)), (err: unknown) => err instanceof FotoaiPayloadTooLargeError && err.status === 413);
  // A declared length over the cap is refused before reading.
  await assert.rejects(readJsonBody(jsonReq('{}', { 'content-length': String(MAX_JSON_BODY_BYTES + 1) })), FotoaiPayloadTooLargeError);
  // Multi-byte characters count as bytes, not characters.
  await assert.rejects(readJsonBody(jsonReq(JSON.stringify({ pad: 'é'.repeat(MAX_JSON_BODY_BYTES / 2) }))), FotoaiPayloadTooLargeError);
  // A caller may pass a larger cap.
  assert.equal(((await readJsonBody(jsonReq(over), MAX_JSON_BODY_BYTES * 2)).pad as string).length, MAX_JSON_BODY_BYTES - 9);
  // Not JSON is still 400.
  await assert.rejects(readJsonBody(jsonReq('nope')), (err: unknown) => err instanceof FotoaiError && err.status === 400);
});

test('readJsonBody: an oversized body on an unauthenticated route (login) is 413 and reaches no GoTrue call', async () => {
  const { createAuthHandlers } = await import('../../lib/fotoai/handlers/auth.ts');
  const { createTestDeps } = await import('./helpers/deps.ts');
  const deps = createTestDeps();
  let signIns = 0;
  deps.client.signInWithPassword = async () => { signIns += 1; throw new Error('must not be called'); };
  const auth = createAuthHandlers(() => deps);
  const res = await auth.login(new Request('http://localhost/api/fotoai/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@test.invalid', password: 'p'.repeat(200 * 1024) }),
  }));
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, 'payload_too_large');
  assert.equal(signIns, 0);
});
