import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonRequest, RequestBodyTooLargeError } from '../lib/request-json.mjs';

const requestWithChunks = (chunks, headers = new Headers()) => ({
  headers,
  body: new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  }),
});

test('bounded JSON reader accepts payload exactly at its byte limit', async () => {
  const body = '{"text":"ok"}';
  const result = await readJsonRequest(requestWithChunks([body]), { maxBytes: new TextEncoder().encode(body).byteLength });
  assert.deepEqual(result, { text: 'ok' });
});

test('bounded JSON reader rejects overflow while reading chunks and cancels the body', async () => {
  let cancelled = false;
  const request = {
    headers: new Headers(),
    body: new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"text":"long"}')); },
      cancel() { cancelled = true; },
    }),
  };
  await assert.rejects(readJsonRequest(request, { maxBytes: 4, label: 'Search' }), error => {
    assert.ok(error instanceof RequestBodyTooLargeError);
    assert.equal(error.status, 413);
    assert.match(error.message, /Search request is too large/);
    return true;
  });
  assert.equal(cancelled, true);
});

test('bounded JSON reader rejects oversized Content-Length before pulling the body', async () => {
  let readerCreated = false;
  const request = {
    headers: new Headers({ 'content-length': '100' }),
    body: { getReader() { readerCreated = true; throw Error('body reader should not be created'); } },
  };
  await assert.rejects(readJsonRequest(request, { maxBytes: 10 }), { status: 413 });
  assert.equal(readerCreated, false);
});
