import Fastify from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { buildGateway } from './app.js';

// Binds an ephemeral localhost port for a stub upstream; the proxy needs a real socket to forward to.
const upstream = Fastify();
let hits = 0;
let upstreamUrl: string;

beforeAll(async () => {
  upstream.all('/*', (request) => {
    hits += 1;
    return { path: request.url, requestId: request.headers['x-request-id'] ?? null };
  });
  upstreamUrl = await upstream.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await upstream.close();
});

function build() {
  return buildGateway({
    routes: [{ prefix: '/api/v1/catalog', upstream: upstreamUrl }],
    corsOrigins: [],
    rateLimitMax: 1000,
    logLevel: 'silent',
  });
}

test('a request under a route prefix, always, reaches the upstream without the prefix', async () => {
  const app = await build();

  const res = await app.inject({ method: 'GET', url: '/api/v1/catalog/demo/pings/abc?x=1' });

  expect(res.statusCode).toBe(200);
  expect(res.json().path).toBe('/demo/pings/abc?x=1');
});

test('a forwarded request, always, carries one request id to the upstream and back', async () => {
  const app = await build();

  const res = await app.inject({ method: 'GET', url: '/api/v1/catalog/demo/x' });

  const forwarded = res.json().requestId;
  expect(forwarded).toBeTypeOf('string');
  expect(res.headers['x-request-id']).toBe(forwarded);
});

test('a request to an internal path, always, never reaches the upstream', async () => {
  const app = await build();
  const before = hits;

  const res = await app.inject({ method: 'POST', url: '/api/v1/catalog/internal/charges' });

  expect(res.statusCode).toBe(404);
  expect(hits).toBe(before);
});

test.each([
  ['percent-encoded letter', '/api/v1/catalog/%69nternal/charges'],
  ['encoded slash', '/api/v1/catalog/x%2Finternal%2Fcharges'],
  ['dot segment', '/api/v1/catalog/demo/../internal/charges'],
  ['doubled slash', '/api/v1/catalog//internal/charges'],
  ['malformed encoding', '/api/v1/catalog/%E0%A4%A/internal'],
])(
  'an internal path disguised with a %s, always, never reaches the upstream',
  async (_name, url) => {
    const app = await build();
    const before = hits;

    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(hits).toBe(before);
  },
);
