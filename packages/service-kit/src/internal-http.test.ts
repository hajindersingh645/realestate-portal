import { delay } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { internalGet } from './internal-http.js';

const BASE = 'http://catalog.internal';
const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

test('internalGet, on 200, returns the parsed body', async () => {
  server.use(
    http.get(`${BASE}/internal/locations`, () => HttpResponse.json({ data: [{ id: 'a' }] })),
  );

  const body = await internalGet<{ data: { id: string }[] }>(BASE, '/internal/locations?ids=a');

  expect(body).toEqual({ data: [{ id: 'a' }] });
});

test('internalGet, on 500, throws UPSTREAM_UNAVAILABLE with status 503', async () => {
  server.use(http.get(`${BASE}/x`, () => new HttpResponse(null, { status: 500 })));

  await expect(internalGet(BASE, '/x')).rejects.toMatchObject({
    code: 'UPSTREAM_UNAVAILABLE',
    httpStatus: 503,
  });
});

test('internalGet, when the upstream is slower than the timeout, throws UPSTREAM_UNAVAILABLE', async () => {
  server.use(
    http.get(`${BASE}/slow`, async () => {
      await delay(200);
      return HttpResponse.json({});
    }),
  );

  await expect(internalGet(BASE, '/slow', { timeoutMs: 20 })).rejects.toMatchObject({
    code: 'UPSTREAM_UNAVAILABLE',
  });
});
