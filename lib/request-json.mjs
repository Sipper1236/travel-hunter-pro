export class RequestBodyTooLargeError extends Error {
  constructor(label) {
    super(`${label} request is too large.`);
    this.name = 'RequestBodyTooLargeError';
    this.status = 413;
  }
}

/** Read a JSON request without buffering more than the route's byte budget. */
export async function readJsonRequest(request, { maxBytes = 12_000, label = 'Request' } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive safe integer.');
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader !== null && /^\d+$/.test(lengthHeader.trim()) && Number(lengthHeader) > maxBytes) {
    throw new RequestBodyTooLargeError(label);
  }

  const reader = request.body?.getReader();
  if (!reader) return JSON.parse('');
  const bytes = new Uint8Array(maxBytes);
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (totalBytes + value.byteLength > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new RequestBodyTooLargeError(label);
    }
    bytes.set(value, totalBytes);
    totalBytes += value.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes.subarray(0, totalBytes)));
}
